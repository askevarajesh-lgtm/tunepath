const fs = require('fs');
const path = require('path');

const IS_DEV = process.env.NODE_ENV !== 'production';

class SkillLoaderService {
  constructor() {
    this.skillsDir = path.join(__dirname, '../skills');
  }

  /**
   * Returns the SKILL.md content for a skill, or null if missing.
   * Logs a clear warning so missing skills are never silently ignored.
   *
   * @param {string} skillName
   * @param {string} [agentContext] - optional agent key for better error context
   * @returns {string|null} Markdown content or null when the skill file is absent
   */
  getSkillContent(skillName, agentContext) {
    try {
      const skillPath = path.join(this.skillsDir, skillName, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        return fs.readFileSync(skillPath, 'utf8');
      }

      // Skill file is genuinely missing — warn clearly
      const agentTag = agentContext ? ` (agent: ${agentContext})` : '';
      const missingPath = path.relative(process.cwd(), path.join(this.skillsDir, skillName, 'SKILL.md'));

      if (IS_DEV) {
        console.warn(
          `[SkillLoader] ⚠️  MISSING SKILL${agentTag}: "${skillName}"\n` +
          `  Expected at: ${missingPath}\n` +
          `  The agent will run without this skill's methodology. Create the file to fix this.`
        );
      } else {
        // Production: still log, but without the multi-line stack hint
        console.warn(`[SkillLoader] Missing skill "${skillName}"${agentTag} — agent will proceed without it.`);
      }

      return null;
    } catch (error) {
      console.error(`[SkillLoader] Error reading skill "${skillName}":`, error.message);
      return null;
    }
  }

  /**
   * Loads and concatenates all skill content for an agent.
   * Reports any missing skills clearly. Does NOT silently omit them.
   *
   * @param {string[]} skillNames
   * @param {string} [agentKey] - for logging context
   * @returns {{ context: string, loaded: string[], missing: string[] }}
   */
  loadSkillsForAgent(skillNames, agentKey) {
    const loaded = [];
    const missing = [];
    let combinedContext = '\n--- REQUIRED METHODOLOGIES & SKILLS ---\n';

    skillNames.forEach(skill => {
      const content = this.getSkillContent(skill, agentKey);
      if (content) {
        combinedContext += `\n# Skill: ${skill}\n${content}\n`;
        loaded.push(skill);
      } else {
        missing.push(skill);
      }
    });

    if (missing.length > 0 && IS_DEV) {
      console.warn(
        `[SkillLoader] Agent "${agentKey || 'unknown'}" is missing ${missing.length} skill(s): ${missing.join(', ')}`
      );
    }

    // Return the string directly to preserve backward-compatibility with callers
    // that treat the return value as a string.
    // Attach metadata as non-enumerable properties so existing string concatenation
    // and template-literal usage still works.
    const result = combinedContext;
    return Object.assign(result, { _loaded: loaded, _missing: missing });
  }

  /**
   * Checks whether all listed skills exist on disk without loading them.
   * Useful for validation / health-check endpoints.
   *
   * @param {string[]} skillNames
   * @returns {{ allPresent: boolean, missing: string[] }}
   */
  validateSkills(skillNames) {
    const missing = skillNames.filter(name => {
      const p = path.join(this.skillsDir, name, 'SKILL.md');
      return !fs.existsSync(p);
    });
    return { allPresent: missing.length === 0, missing };
  }
}

module.exports = new SkillLoaderService();

