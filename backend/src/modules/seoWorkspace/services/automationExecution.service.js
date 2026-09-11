const logger = require('../../aiCore/logger.service');
const { getActionRegistry } = require('./automationActionRegistry.service');
const { getTriggerRegistry } = require('./automationTriggerRegistry.service');
const { evaluateExpression } = require('./automationExpression.service');
const AutomationWorkflow = require('../models/automationWorkflow.model');
const AutomationExecutionRun = require('../models/automationExecutionRun.model');
const AutomationExecutionNodeLog = require('../models/automationExecutionNodeLog.model');
const AutomationWorkflowVersion = require('../models/automationWorkflowVersion.model');
const WorkspaceProject = require('../models/workspaceProject.model');

const TAG = 'AutomationExecutionEngine';

class AutomationExecutionEngine {
  /**
   * Universal runner for a workflow
   */
  async runWorkflow(projectId, workflowId, triggerContext = {}) {
    const workflow = await AutomationWorkflow.findOne({ _id: workflowId, projectId });
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found in project ${projectId}`);
    }

    let versionId = triggerContext.versionId || workflow.activeVersionId;
    if (!versionId) {
      const latestVersion = await AutomationWorkflowVersion.findOne({ workflowId }).sort({ versionNumber: -1 });
      if (!latestVersion) throw new Error('No workflow version available to execute');
      versionId = latestVersion._id;
    }

    return this.executeWorkflowRun(projectId, workflowId, versionId, triggerContext);
  }

  /**
   * Runs workflow in simulation / dry-run mode
   */
  async simulateWorkflowRun(projectId, workflowId, versionId, mockPayload = {}) {
    logger.info(TAG, `Starting simulation run for workflow ${workflowId}`);
    return this.executeWorkflowRun(projectId, workflowId, versionId, {
      source: 'simulation',
      isSimulation: true,
      payload: mockPayload,
      variables: mockPayload
    });
  }

  /**
   * Executes a workflow version DAG
   */
  async executeWorkflowRun(projectId, workflowId, versionId, triggerContext = {}) {
    logger.info(TAG, `Starting enterprise workflow execution`, { projectId, workflowId, versionId });
    
    // Retrieve or Create Run Record
    let run = null;
    if (triggerContext.runId) {
      run = await AutomationExecutionRun.findById(triggerContext.runId);
    }
    if (run) {
      run.status = 'Running';
      run.startTime = new Date();
      run.triggerContext = { ...run.triggerContext, ...triggerContext };
      await run.save();
    } else {
      run = await AutomationExecutionRun.create({
        projectId,
        workflowId,
        versionId,
        triggerContext,
        status: 'Running',
        startTime: new Date()
      });
    }

    const compensationStack = [];

    try {
      const [version, project] = await Promise.all([
        AutomationWorkflowVersion.findById(versionId).lean(),
        WorkspaceProject.findById(projectId).lean()
      ]);

      if (!version) throw new Error('Workflow version not found');

      const nodes = version.nodes || [];
      const edges = version.edges || [];
      
      const context = {
        projectId,
        project: project || { _id: projectId, name: 'SEO Project' },
        workflowId,
        versionId,
        runId: run._id,
        trigger: triggerContext,
        isSimulation: Boolean(triggerContext.isSimulation),
        variables: { ...(version.variables || {}), ...(triggerContext.variables || {}) },
        nodeOutputs: {},
        steps: {},
        compensationStack
      };

      if (nodes.length === 0) {
        throw new Error('Workflow version contains no nodes');
      }

      // Identify starting nodes (Trigger nodes or nodes with no incoming edges)
      const targetIds = new Set(edges.map(e => e.target));
      let startNodes = nodes.filter(n => !targetIds.has(n.id) || n.type === 'trigger' || n.data?.type === 'trigger');

      if (startNodes.length === 0) {
        startNodes = [nodes[0]];
      }

      // Execute DAG
      await this.traverseDAG(startNodes, nodes, edges, context);

      run.status = 'Succeeded';
      run.endTime = new Date();
      run.durationMs = run.endTime.getTime() - run.startTime.getTime();
      run.result = { outputs: context.nodeOutputs };
      await run.save();

      return run;

    } catch (error) {
      logger.error(TAG, `Workflow execution failed`, { error: error.message, runId: run._id });
      
      // Execute compensation stack if any
      if (compensationStack.length > 0) {
        await this._runCompensations(compensationStack, projectId, run._id);
      }

      run.status = 'Failed';
      run.error = error.message;
      run.endTime = new Date();
      run.durationMs = run.endTime.getTime() - run.startTime.getTime();
      await run.save();
      throw error;
    }
  }

  async traverseDAG(startNodes, allNodes, edges, context) {
    const queue = [...startNodes];
    const visited = new Set();
    const actionRegistry = getActionRegistry();

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || visited.has(node.id)) continue;
      
      // Check incoming dependencies
      const incomingEdges = edges.filter(e => e.target === node.id);
      const unvisitedDependencies = incomingEdges.filter(e => !visited.has(e.source));
      
      if (unvisitedDependencies.length > 0) {
        continue;
      }

      visited.add(node.id);

      const effectiveType = ((node.data?.type || node.type) || 'action').toLowerCase();
      const nodeName = node.data?.label || node.data?.name || node.id;
      const subtype = (node.data?.subtype || node.data?.actionId || node.data?.triggerId || '').toLowerCase();

      // Create live node execution log
      const log = await AutomationExecutionNodeLog.create({
        executionRunId: context.runId,
        workflowId: context.workflowId,
        nodeId: node.id,
        nodeType: effectiveType,
        nodeName: nodeName,
        status: 'Started',
        startTime: new Date(),
        inputPayload: node.data?.config || {}
      });

      let output = null;

      try {
        const resolvedConfig = this.resolveVariablesInConfig(node.data?.config || {}, context);

        if (effectiveType === 'trigger') {
          // Check if trigger is an active runner
          let actionModule = actionRegistry.getAction(subtype) ||
            actionRegistry.getAction(subtype.replace('trigger_', 'run_')) ||
            actionRegistry.getAction(subtype.replace('trigger_', ''));

          if (actionModule && (subtype.includes('audit') || subtype.includes('crawl'))) {
            output = await actionModule.execute(resolvedConfig, context);
          } else {
            output = { success: true, triggered: true, data: context.trigger };
          }
        } else if (effectiveType === 'condition' || subtype === 'if_else') {
          const conditionExp = node.data?.config?.expression || node.data?.expression;
          let condResult = true;
          try {
            condResult = evaluateExpression(conditionExp, context);
          } catch (e) {
            condResult = true;
          }
          output = { success: true, result: Boolean(condResult), branch: condResult ? 'true' : 'false' };
        } else if (effectiveType === 'switch' || subtype === 'multi_switch') {
          output = { success: true, branch: 'default' };
        } else if (effectiveType === 'delay') {
          output = { success: true, delayedMinutes: Number(resolvedConfig?.delayMinutes) || 1 };
        } else {
          // General Action / SEO Module execution
          let actionModule = actionRegistry.getAction(subtype) ||
            actionRegistry.getAction(`action_${subtype}`) ||
            actionRegistry.getAction(subtype.replace('trigger_', 'run_')) ||
            actionRegistry.getAction(subtype.replace('run_', 'trigger_')) ||
            actionRegistry.getAction(subtype.replace('send_', '')) ||
            actionRegistry.getAction(`send_${subtype}`);

          if (!actionModule) {
            const cleanSub = subtype.replace(/[^a-z0-9_]/g, '');
            actionModule = actionRegistry.getAction(cleanSub);
          }

          if (!actionModule) {
            logger.info(TAG, `Executing generic action step: ${nodeName} (${subtype})`);
            output = { success: true, executed: true, data: resolvedConfig };
          } else {
            // Register compensation hook if available
            if (typeof actionModule.compensate === 'function') {
              context.compensationStack.push(() => actionModule.compensate(resolvedConfig, context));
            }

            let attempts = 0;
            const maxRetries = Number(node.data?.retryCount) || 1;
            let delayMs = 1000;

            while (attempts < maxRetries) {
              try {
                output = await actionModule.execute(resolvedConfig, context);
                break;
              } catch (retryErr) {
                attempts++;
                if (attempts < maxRetries) {
                  log.status = 'Retrying';
                  log.message = `Attempt ${attempts} failed: ${retryErr.message}. Retrying in ${delayMs}ms...`;
                  await log.save();
                  await new Promise(r => setTimeout(r, delayMs));
                  delayMs *= 2;
                } else {
                  throw retryErr;
                }
              }
            }
          }
        }

        context.nodeOutputs[node.id] = output;
        context.steps[node.id] = output;
        if (subtype) {
          context.steps[subtype] = output;
          context.steps[subtype.replace('trigger_', 'run_')] = output;
          context.steps[subtype.replace('run_', 'trigger_')] = output;
          
          // Map canonical friendly step aliases
          const sub = subtype.toLowerCase();
          if (sub.includes('site_audit')) {
            context.steps['audit'] = output;
          } else if (sub.includes('keyword')) {
            context.steps['keyword'] = output;
          } else if (sub.includes('content')) {
            context.steps['content'] = output;
          } else if (sub.includes('schema')) {
            context.steps['schema'] = output;
          } else if (sub.includes('monitoring') || sub.includes('monitor')) {
            context.steps['monitor'] = output;
            context.steps['monitoring'] = output;
          } else if (sub.includes('geo')) {
            context.steps['geo'] = output;
          } else if (sub.includes('aeo')) {
            context.steps['aeo'] = output;
          } else if (sub.includes('competitor')) {
            context.steps['competitor'] = output;
          } else if (sub.includes('report')) {
            context.steps['report'] = output;
          } else if (sub.includes('internal_link') || sub.includes('generate_internal_links')) {
            context.steps['linking'] = output;
            context.steps['internal_linking'] = output;
          } else if (sub.includes('image')) {
            context.steps['image'] = output;
          } else if (sub.includes('technical')) {
            context.steps['technical'] = output;
            context.steps['technical_seo'] = output;
          }
        }
        if (node.data?.label) {
          const sanitized = node.data.label.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          context.steps[sanitized] = output;
        }
        
        if (output && typeof output === 'object') {
          Object.assign(context.variables, output);
        }

        log.status = 'Completed';
        log.outputPayload = output;
        log.endTime = new Date();
        log.durationMs = log.endTime.getTime() - log.startTime.getTime();
        await log.save();

      } catch (err) {
        log.status = 'Failed';
        log.errorDetails = err.message;
        log.endTime = new Date();
        log.durationMs = log.endTime.getTime() - log.startTime.getTime();
        await log.save();

        if (node.data?.continueOnError) {
          logger.warn(TAG, `Node ${node.id} failed but continueOnError is true. Continuing...`);
          context.nodeOutputs[node.id] = { hasError: true, error: err.message };
        } else {
          throw err;
        }
      }

      // Enqueue next downstream nodes
      const outgoingEdges = edges.filter(e => e.source === node.id);
      for (const edge of outgoingEdges) {
        if (output && output.branch) {
          const targetPort = (edge.sourceHandle || edge.label || '').toLowerCase();
          const activeBranch = String(output.branch).toLowerCase();
          if (targetPort && targetPort !== activeBranch && targetPort !== 'any') {
            continue; // Skip inactive branch
          }
        }

        const nextNode = allNodes.find(n => n.id === edge.target);
        if (nextNode && !visited.has(nextNode.id)) {
          queue.push(nextNode);
        }
      }
    }
  }

  resolveVariablesInConfig(config, context) {
    if (!config) return config;
    if (typeof config === 'string') {
      return evaluateExpression(config, context, true);
    }
    if (Array.isArray(config)) {
      return config.map(item => this.resolveVariablesInConfig(item, context));
    }
    if (typeof config === 'object') {
      const resolved = {};
      for (const [k, v] of Object.entries(config)) {
        resolved[k] = this.resolveVariablesInConfig(v, context);
      }
      return resolved;
    }
    return config;
  }

  async _runCompensations(stack, projectId, runId) {
    logger.info(TAG, `Executing compensation stack (${stack.length} actions) for run ${runId}`);
    for (const comp of stack.reverse()) {
      try {
        if (typeof comp === 'function') await comp();
      } catch (e) {
        logger.error(TAG, `Compensation item failed: ${e.message}`);
      }
    }
  }
}

module.exports = new AutomationExecutionEngine();
