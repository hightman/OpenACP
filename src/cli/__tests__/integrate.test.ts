import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    homedir: () => process.env.OPENACP_TEST_HOME ?? actual.homedir(),
  };
});

describe("integrate opencode plugin strategy", () => {
  let tmpDir = "";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openacp-integrate-test-"));
    process.env.OPENACP_TEST_HOME = tmpDir;
  });

  afterEach(() => {
    delete process.env.OPENACP_TEST_HOME;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("installs and uninstalls opencode handoff files", async () => {
    const { getAgentCapabilities } = await import("../../core/agents/agent-dependencies.js");
    const { installIntegration, uninstallIntegration, getIntegration } = await import("../integrate.js");

    const caps = getAgentCapabilities("opencode");
    expect(caps.integration?.strategy).toBe("plugin");
    if (!caps.integration || caps.integration.strategy !== "plugin") {
      throw new Error("Expected opencode plugin integration spec");
    }

    const installResult = await installIntegration("opencode", caps.integration);
    expect(installResult.success).toBe(true);

    const commandPath = path.join(tmpDir, ".config", "opencode", "commands", "openacp-handoff.md");
    const pluginPath = path.join(tmpDir, ".config", "opencode", "plugins", "openacp-handoff.js");
    expect(fs.existsSync(commandPath)).toBe(true);
    expect(fs.existsSync(pluginPath)).toBe(true);

    const commandContent = fs.readFileSync(commandPath, "utf-8");
    expect(commandContent).toContain("name: openacp:handoff");
    const pluginContent = fs.readFileSync(pluginPath, "utf-8");
    expect(pluginContent).toContain("OPENCODE_SESSION_ID");

    const integration = getIntegration("opencode");
    expect(integration).toBeDefined();
    expect(integration!.items.map((item) => item.id)).toEqual(["handoff"]);
    expect(integration!.items[0]!.isInstalled()).toBe(true);

    const uninstallResult = await uninstallIntegration("opencode", caps.integration);
    expect(uninstallResult.success).toBe(true);
    expect(fs.existsSync(commandPath)).toBe(false);
    expect(fs.existsSync(pluginPath)).toBe(false);
    expect(integration!.items[0]!.isInstalled()).toBe(false);
  });
});
