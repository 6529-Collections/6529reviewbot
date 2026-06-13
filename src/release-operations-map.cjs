"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_RELEASE_OPERATIONS_MAP_PATH = "config/release-operations-map.json";
const VALID_TEXT_MAX_CHARS = 1200;

function loadReleaseOperationsMap(filePath = DEFAULT_RELEASE_OPERATIONS_MAP_PATH) {
  return validateReleaseOperationsMap(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
}

function validateReleaseOperationsMap(document, source = "release operations map", options = {}) {
  assertObject(document, source);
  if (document.version !== 1) {
    throw new Error(`${source} version must be 1.`);
  }
  const title = requiredText(document.title, `${source}.title`);
  const description = requiredText(document.description, `${source}.description`);
  if (!Array.isArray(document.phases) || document.phases.length === 0) {
    throw new Error(`${source}.phases must be a non-empty array.`);
  }
  const scripts = options.packageScripts || {};
  const repoRoot = options.repoRoot || process.cwd();
  const checkScripts = Object.keys(scripts).length > 0;
  const seenPhaseIds = new Set();
  const seenToolIds = new Set();
  const phases = document.phases.map((phase, phaseIndex) => {
    assertObject(phase, `${source}.phases[${phaseIndex}]`);
    const id = idField(phase.id, `${source}.phases[${phaseIndex}].id`);
    if (seenPhaseIds.has(id)) {
      throw new Error(`${source}.phases[${phaseIndex}].id '${id}' is duplicated.`);
    }
    seenPhaseIds.add(id);
    if (!Array.isArray(phase.tools) || phase.tools.length === 0) {
      throw new Error(`${source}.phases[${phaseIndex}].tools must be a non-empty array.`);
    }
    return {
      id,
      title: requiredText(phase.title, `${source}.phases[${phaseIndex}].title`),
      when: requiredText(phase.when, `${source}.phases[${phaseIndex}].when`),
      boundary: requiredText(phase.boundary, `${source}.phases[${phaseIndex}].boundary`),
      tools: phase.tools.map((tool, toolIndex) => {
        assertObject(tool, `${source}.phases[${phaseIndex}].tools[${toolIndex}]`);
        const toolId = idField(tool.id, `${source}.phases[${phaseIndex}].tools[${toolIndex}].id`);
        if (seenToolIds.has(toolId)) {
          throw new Error(`${source}.phases[${phaseIndex}].tools[${toolIndex}].id '${toolId}' is duplicated.`);
        }
        seenToolIds.add(toolId);
        const script = scriptField(tool.script, `${source}.phases[${phaseIndex}].tools[${toolIndex}].script`);
        if (checkScripts && !Object.prototype.hasOwnProperty.call(scripts, script)) {
          throw new Error(`${source}.phases[${phaseIndex}].tools[${toolIndex}].script '${script}' is not in package.json.`);
        }
        const doc = docPathField(tool.doc, `${source}.phases[${phaseIndex}].tools[${toolIndex}].doc`);
        const docPath = path.resolve(repoRoot, doc);
        if (options.checkDocs && !fs.existsSync(docPath)) {
          throw new Error(`${source}.phases[${phaseIndex}].tools[${toolIndex}].doc '${doc}' does not exist.`);
        }
        const args = argsField(tool.args, `${source}.phases[${phaseIndex}].tools[${toolIndex}].args`);
        return {
          id: toolId,
          script,
          args,
          command: commandForTool(script, args),
          purpose: requiredText(tool.purpose, `${source}.phases[${phaseIndex}].tools[${toolIndex}].purpose`),
          doc,
          privateInputs: optionalText(tool.privateInputs),
          publicOutput: requiredText(tool.publicOutput, `${source}.phases[${phaseIndex}].tools[${toolIndex}].publicOutput`),
        };
      }),
    };
  });
  return {
    version: 1,
    title,
    description,
    phases,
  };
}

function renderReleaseOperationsMapMarkdown(document, options = {}) {
  const map = validateReleaseOperationsMap(document);
  const phases = options.phase
    ? map.phases.filter((phase) => phase.id === options.phase)
    : map.phases;
  if (options.phase && phases.length === 0) {
    throw new Error(`unknown release operations phase '${options.phase}'.`);
  }
  const lines = [
    `# ${map.title}`,
    "",
    map.description,
    "",
    "This is a command map, not a replacement for operator judgment. Private",
    "status and evidence files stay outside the public repository unless an",
    "operator intentionally publishes redacted summaries.",
    "",
  ];
  for (const phase of phases) {
    lines.push(`## ${phase.title}`, "", `When: ${phase.when}`, "", `Boundary: ${phase.boundary}`, "");
    lines.push("| Command | Purpose | Evidence Boundary | Docs |");
    lines.push("| --- | --- | --- | --- |");
    for (const tool of phase.tools) {
      const boundary = tool.privateInputs
        ? `${tool.privateInputs} ${tool.publicOutput}`
        : tool.publicOutput;
      lines.push(
        `| \`${markdownCell(tool.command)}\` | ${markdownCell(tool.purpose)} | ${markdownCell(boundary)} | [${markdownCell(tool.doc)}](${markdownCell(tool.doc)}) |`
      );
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function summarizeReleaseOperationsMap(document) {
  const map = validateReleaseOperationsMap(document);
  const toolCount = map.phases.reduce((count, phase) => count + phase.tools.length, 0);
  const privateInputCount = map.phases.reduce(
    (count, phase) => count + phase.tools.filter((tool) => Boolean(tool.privateInputs)).length,
    0
  );
  return {
    version: map.version,
    phaseCount: map.phases.length,
    toolCount,
    privateInputCount,
    publicOnlyToolCount: toolCount - privateInputCount,
    phases: map.phases.map((phase) => ({
      id: phase.id,
      title: phase.title,
      toolCount: phase.tools.length,
    })),
  };
}

function commandForTool(script, args = "") {
  const trimmedArgs = optionalText(args);
  return trimmedArgs ? `npm run ${script} ${trimmedArgs}` : `npm run ${script}`;
}

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
}

function idField(value, field) {
  if (!/^[a-z][a-z0-9-]{1,80}$/.test(value || "")) {
    throw new Error(`${field} must be a lowercase kebab-case id.`);
  }
  return value;
}

function scriptField(value, field) {
  if (!/^[a-z0-9][a-z0-9:_-]{0,80}$/.test(value || "")) {
    throw new Error(`${field} must be an npm script name.`);
  }
  return value;
}

function docPathField(value, field) {
  const text = requiredText(value, field);
  const allowedPublicPath = /^(?:(?:docs|infra|\.github|templates|config)\/|[A-Z0-9_.-]+\.md$)/i;
  if (path.isAbsolute(text) || text.includes("..") || !allowedPublicPath.test(text)) {
    throw new Error(`${field} must be a public repository documentation path.`);
  }
  return text;
}

function argsField(value, field) {
  const text = optionalText(value);
  if (text && text.startsWith("--") && !text.startsWith("-- --")) {
    throw new Error(`${field} must use the repo npm flag-forwarding form '-- -- --flag'.`);
  }
  return text;
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string.`);
  }
  if (value.length > VALID_TEXT_MAX_CHARS) {
    throw new Error(`${field} must be ${VALID_TEXT_MAX_CHARS} characters or less.`);
  }
  return value.trim();
}

function optionalText(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error("optional text fields must be strings when set.");
  }
  if (value.length > VALID_TEXT_MAX_CHARS) {
    throw new Error(`optional text fields must be ${VALID_TEXT_MAX_CHARS} characters or less.`);
  }
  return value.trim();
}

function markdownCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

module.exports = {
  DEFAULT_RELEASE_OPERATIONS_MAP_PATH,
  loadReleaseOperationsMap,
  renderReleaseOperationsMapMarkdown,
  summarizeReleaseOperationsMap,
  validateReleaseOperationsMap,
};
