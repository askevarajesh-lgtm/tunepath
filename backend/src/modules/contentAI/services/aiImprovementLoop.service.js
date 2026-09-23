const aiOrchestrator = require('../providers/AIOrchestrator');
const promptBuilder = require('../prompts/promptBuilder');
const contentEvents = require('../events/contentEvents');

class AIImprovementLoopService {
  /**
   * Evaluates content and recursively improves it until thresholds are met or max iterations reached.
   */
  async optimizeContent(content, brief, maxIterations = 3) {
    let currentContent = content;
    let iteration = 0;
    
    while (iteration < maxIterations) {
      // 1. Evaluate Current Content (mocked scoring for now, would integrate with SEOQualityEngine)
      const currentScore = this._evaluateSEO(currentContent, brief);
      
      if (currentScore.overall >= 95) {
        console.log(`[AIImprovementLoop] Content reached target quality at iteration ${iteration}`);
        break;
      }
      
      console.log(`[AIImprovementLoop] Iteration ${iteration}: Score ${currentScore.overall}. Improving...`);
      
      // 2. Generate Improvement Prompt
      const improvementPrompt = promptBuilder.buildPrompt('improve', brief);
      
      // 3. Call AI Orchestrator to improve
      try {
        currentContent = await aiOrchestrator.generateContent(
          `Original Content:\n\n${currentContent}`,
          improvementPrompt,
          { maxTokens: 4096 }
        );
      } catch (err) {
        console.error(`[AIImprovementLoop] Orchestrator failed during improvement loop:`, err);
        break; // Break and return what we have if AI fails
      }
      
      iteration++;
    }
    
    // Emit event that loop finished
    contentEvents.emit(contentEvents.EVENTS.CONTENT_UPDATED, { content: currentContent, finalIterations: iteration });
    
    return {
      finalContent: currentContent,
      iterations: iteration
    };
  }
  
  _evaluateSEO(content, brief) {
    // Highly simplified mock evaluation.
    // In reality, this delegates to SEOQualityEngine.
    let score = 70;
    const lowerContent = content ? content.toLowerCase() : '';
    
    if (brief?.keywords?.primary && lowerContent.includes(brief.keywords.primary.toLowerCase())) {
      score += 15;
    }
    
    let secondaryFound = 0;
    if (brief?.keywords?.secondary && Array.isArray(brief.keywords.secondary)) {
      brief.keywords.secondary.forEach(kw => {
        if (kw && lowerContent.includes(kw.toLowerCase())) secondaryFound++;
      });
    }
    
    score += (secondaryFound * 2);
    
    return {
      overall: Math.min(score, 100),
      seo: score,
      readability: 85
    };
  }
}

module.exports = new AIImprovementLoopService();
