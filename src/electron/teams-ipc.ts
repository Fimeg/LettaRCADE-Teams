import { ipcMainHandle } from "./util.js";
import type { DispatchTaskInput, SpawnTeammateInput, TaskStatus } from "letta-teams-sdk";
import type { TeamsConfigureInput, TeamsRuntimeManager } from "./teams-runtime.js";

export function registerTeamsIpc(teamsRuntime: TeamsRuntimeManager): void {
  ipcMainHandle("teams:configure", (_event, input: TeamsConfigureInput) => teamsRuntime.configure(input));

  ipcMainHandle("teams:daemon:get-status", () => teamsRuntime.getDaemonStatus());
  ipcMainHandle("teams:daemon:ensure-running", () => teamsRuntime.ensureDaemonRunning());

  ipcMainHandle("teams:teammates:list", () => teamsRuntime.listTeammates());
  ipcMainHandle("teams:teammates:get", (_event, name: string) => teamsRuntime.getTeammate(name));
  ipcMainHandle("teams:teammates:spawn", (_event, input: SpawnTeammateInput) => teamsRuntime.spawnTeammate(input));
  ipcMainHandle("teams:teammates:fork", (_event, name: string, forkName: string) => teamsRuntime.forkTeammate(name, forkName));
  ipcMainHandle("teams:teammates:reinit", (_event, name: string, prompt?: string) => teamsRuntime.reinitTeammate(name, prompt));

  ipcMainHandle("teams:tasks:list", (_event, status?: TaskStatus) => teamsRuntime.listTasks(status));
  ipcMainHandle("teams:tasks:get", (_event, id: string) => teamsRuntime.getTask(id));
  ipcMainHandle("teams:tasks:dispatch", (_event, input: DispatchTaskInput) => teamsRuntime.dispatchTask(input));
  ipcMainHandle("teams:tasks:wait", (_event, id: string) => teamsRuntime.waitForTask(id));
  ipcMainHandle("teams:tasks:cancel", (_event, id: string) => teamsRuntime.cancelTask(id));
}
