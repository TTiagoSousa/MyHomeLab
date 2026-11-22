import { Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import * as Private_Page from '../Imports/privatePages';
import * as Intermediate_Pages from '../Imports/intermediaryPages';
import Admin_Check from '../Authentication/Admin_Check';
import Legacy_Board_Redirect from './Legacy_Board_Redirect';
import Tasks_Entry from './Tasks_Entry';

const Private_Routes = () => {
  return (
    <Suspense fallback={<Intermediate_Pages.Loading_Page />}>
    <Routes>
      <Route index element={ <Private_Page.Today /> } />
      <Route path='MyHomeLab' element={ <Private_Page.Today /> } />
      <Route path='MyHomeLab/Today' element={ <Private_Page.Today /> } />
      <Route path='MyHomeLab/Services' element={ <Private_Page.Dashboard /> } />
      <Route path='MyHomeLab/Assistant' element={ <Private_Page.Assistant /> } />
      <Route path='MyHomeLab/Assistant/Settings' element={ <Private_Page.AssistantSettings /> } />
      <Route path='MyHomeLab/Assistant/Workflow' element={ <Private_Page.AgentsWorkflow /> } />
      <Route path='MyHomeLab/Email' element={ <Navigate to='/MyHomeLab/Apps/Gmail' replace /> } />
      <Route path='MyHomeLab/Email/:accountId' element={ <Private_Page.LegacyEmailRedirect to='rules' /> } />
      <Route path='MyHomeLab/Email/:accountId/proposals' element={ <Private_Page.LegacyEmailRedirect to='proposals' /> } />
      <Route path='MyHomeLab/Health' element={ <Private_Page.Health /> } />
      <Route path='MyHomeLab/Health/Sleep' element={ <Private_Page.Sleep /> } />
      <Route path='MyHomeLab/Health/Heart' element={ <Private_Page.Heart /> } />
      <Route path='MyHomeLab/Health/Skin' element={ <Private_Page.Skin /> } />
      <Route path='MyHomeLab/Health/Oxygen' element={ <Private_Page.Oxygen /> } />
      <Route path='MyHomeLab/Health/Stress' element={ <Private_Page.Stress /> } />
      <Route path='MyHomeLab/Health/Steps' element={ <Private_Page.Steps /> } />
      <Route path='MyHomeLab/Health/Exercise' element={ <Private_Page.Exercise /> } />
      <Route path='MyHomeLab/Health/Exercise/:workoutId' element={ <Private_Page.Workout /> } />
      <Route path='MyHomeLab/Health/Weight' element={ <Private_Page.Weight /> } />
      <Route path='MyHomeLab/Health/Water' element={ <Private_Page.Water /> } />
      <Route path='MyHomeLab/Health/Labs' element={ <Private_Page.Labs /> } />
      <Route path='MyHomeLab/Health/Labs/:reportId' element={ <Private_Page.LabReport /> } />
      <Route path='MyHomeLab/Health/Medication' element={ <Private_Page.Medication /> } />
      <Route path='MyHomeLab/Health/Diary' element={ <Private_Page.Diary /> } />
      <Route path='MyHomeLab/Health/Profile' element={ <Private_Page.HealthProfile /> } />
      <Route path='MyHomeLab/Health/Nutrition' element={ <Private_Page.Nutrition /> } />
      <Route path='MyHomeLab/Health/Body' element={ <Private_Page.Body /> } />
      <Route path='MyHomeLab/Health/Intakes' element={ <Private_Page.Intakes /> } />
      <Route path='MyHomeLab/Health/Wellbeing' element={ <Private_Page.Wellbeing /> } />
      <Route path='MyHomeLab/Health/Mood' element={ <Private_Page.Mood /> } />
      <Route path='MyHomeLab/Health/Fasting' element={ <Private_Page.Fasting /> } />
      <Route path='MyHomeLab/Servers' element={ <Private_Page.Servers /> } />
      <Route path='MyHomeLab/Docs' element={ <Private_Page.Docs /> } />
      <Route path='MyHomeLab/Docs/:docId' element={ <Private_Page.Docs /> } />
      <Route path='MyHomeLab/Docs/attempts/:attemptId' element={ <Private_Page.Docs /> } />
      <Route path='MyHomeLab/Tasks' element={ <Tasks_Entry /> } />
      <Route path='MyHomeLab/Tasks/:taskId' element={ <Legacy_Board_Redirect /> } />
      <Route path='MyHomeLab/Projects' element={ <Private_Page.Tasks /> } />
      <Route path='MyHomeLab/Projects/:taskId' element={ <Private_Page.Task /> } />
      <Route path='MyHomeLab/Schedules' element={ <Navigate to='/MyHomeLab/Projects?view=triggers' replace /> } />
      <Route path='MyHomeLab/Schedules/:scheduleId' element={ <Private_Page.Schedule /> } />
      <Route path='MyHomeLab/Notifications' element={ <Private_Page.Notifications /> } />
      <Route path='MyHomeLab/Help' element={ <Private_Page.Help /> } />
      <Route path='MyHomeLab/Apps' element={ <Private_Page.Apps /> } />
      <Route path='MyHomeLab/Apps/Nextcloud' element={ <Private_Page.NextcloudAccounts /> } />
      <Route path='MyHomeLab/Apps/Forgejo' element={ <Private_Page.ForgejoAccounts /> } />
      <Route path='MyHomeLab/Apps/Forgejo/:accountId' element={ <Private_Page.ForgejoAccount /> } />
      <Route path='MyHomeLab/Apps/Forgejo/:accountId/Connections' element={ <Private_Page.ForgejoConnections /> } />
      <Route path='MyHomeLab/Apps/Trek' element={ <Private_Page.TrekAccounts /> } />
      <Route path='MyHomeLab/Apps/GoogleTasks' element={ <Private_Page.GoogleTasksAccounts /> } />
      <Route path='MyHomeLab/Apps/GoogleTasks/Connections' element={ <Private_Page.GoogleTasksConnections /> } />
      <Route path='MyHomeLab/Apps/GoogleDrive' element={ <Private_Page.GoogleDriveAccounts /> } />
      <Route path='MyHomeLab/Apps/Trek/:accountId' element={ <Private_Page.TrekAccount /> } />
      <Route path='MyHomeLab/Apps/Trek/:accountId/Connections' element={ <Private_Page.TrekConnections /> } />
      <Route path='MyHomeLab/Apps/HomeAssistant' element={ <Private_Page.HomeAssistantAccounts /> } />
      <Route path='MyHomeLab/Apps/HomeAssistant/:accountId' element={ <Private_Page.HomeAssistantAccount /> } />
      <Route path='MyHomeLab/Apps/HomeAssistant/:accountId/Connections' element={ <Private_Page.HomeAssistantConnections /> } />
      <Route path='MyHomeLab/Apps/AdGuard' element={ <Private_Page.AdguardAccounts /> } />
      <Route path='MyHomeLab/Apps/AdGuard/:accountId' element={ <Private_Page.AdguardAccount /> } />
      <Route path='MyHomeLab/Apps/AdGuard/:accountId/Cron' element={ <Private_Page.AdguardCronJobs /> } />
      <Route path='MyHomeLab/Apps/Proxmox' element={ <Private_Page.ProxmoxServers /> } />
      <Route path='MyHomeLab/Apps/Proxmox/:serverId' element={ <Private_Page.ProxmoxServer /> } />
      <Route path='MyHomeLab/Apps/Proxmox/:serverId/Connections' element={ <Private_Page.ProxmoxConnections /> } />
      <Route path='MyHomeLab/Apps/Proxmox/:serverId/Cron' element={ <Private_Page.ProxmoxCronJobs /> } />
      <Route path='MyHomeLab/Apps/Nextcloud/:accountId' element={ <Private_Page.NextcloudAccount /> } />
      <Route path='MyHomeLab/Apps/OpenGym' element={ <Private_Page.OpenGymAccounts /> } />
      <Route path='MyHomeLab/Apps/OpenGym/:accountId' element={ <Private_Page.OpenGymAccount /> } />
      <Route path='MyHomeLab/Apps/OpenGym/:accountId/Connections' element={ <Private_Page.OpenGymConnections /> } />
      <Route path='MyHomeLab/Apps/GameTracker' element={ <Private_Page.GameTrackerAccounts /> } />
      <Route path='MyHomeLab/Apps/GameTracker/:accountId' element={ <Private_Page.GameTrackerAccount /> } />
      <Route path='MyHomeLab/Apps/GameTracker/:accountId/Connections' element={ <Private_Page.GameTrackerConnections /> } />
      <Route path='MyHomeLab/Apps/Immich' element={ <Private_Page.ImmichAccounts /> } />
      <Route path='MyHomeLab/Apps/Immich/:accountId' element={ <Private_Page.ImmichAccount /> } />
      <Route path='MyHomeLab/Apps/Immich/:accountId/Connections' element={ <Private_Page.ImmichConnections /> } />
      <Route path='MyHomeLab/Apps/Paperless' element={ <Private_Page.PaperlessAccounts /> } />
      <Route path='MyHomeLab/Apps/Paperless/:accountId' element={ <Private_Page.PaperlessAccount /> } />
      <Route path='MyHomeLab/Apps/Paperless/:accountId/Connections' element={ <Private_Page.PaperlessConnections /> } />
      <Route path='MyHomeLab/Apps/Solidtime' element={ <Private_Page.SolidtimeAccounts /> } />
      <Route path='MyHomeLab/Apps/Solidtime/:accountId' element={ <Private_Page.SolidtimeAccount /> } />
      <Route path='MyHomeLab/Apps/Solidtime/:accountId/Connections' element={ <Private_Page.SolidtimeConnections /> } />
      <Route path='MyHomeLab/Apps/Plane' element={ <Private_Page.PlaneAccounts /> } />
      <Route path='MyHomeLab/Apps/Plane/:accountId' element={ <Private_Page.PlaneAccount /> } />
      <Route path='MyHomeLab/Apps/GiteaMirror' element={ <Private_Page.GiteaMirrorAccounts /> } />
      <Route path='MyHomeLab/Apps/GiteaMirror/:accountId' element={ <Private_Page.GiteaMirrorAccount /> } />
      <Route path='MyHomeLab/Apps/Infisical' element={ <Private_Page.InfisicalAccounts /> } />
      <Route path='MyHomeLab/Apps/Infisical/:accountId' element={ <Private_Page.InfisicalAccount /> } />
      <Route path='MyHomeLab/Apps/Vaultwarden' element={ <Private_Page.VaultwardenAccounts /> } />
      <Route path='MyHomeLab/Apps/Vaultwarden/:accountId' element={ <Private_Page.VaultwardenAccount /> } />
      <Route path='MyHomeLab/Apps/Postgres' element={ <Private_Page.PostgresAccounts /> } />
      <Route path='MyHomeLab/Apps/Postgres/:accountId' element={ <Private_Page.PostgresAccount /> } />
      <Route path='MyHomeLab/Apps/ClickHouse' element={ <Private_Page.ClickHouseAccounts /> } />
      <Route path='MyHomeLab/Apps/ClickHouse/:accountId' element={ <Private_Page.ClickHouseAccount /> } />
      <Route path='MyHomeLab/Apps/NginxProxyManager' element={ <Private_Page.NginxProxyManagerAccounts /> } />
      <Route path='MyHomeLab/Apps/NginxProxyManager/:accountId' element={ <Private_Page.NginxProxyManagerAccount /> } />
      <Route path='MyHomeLab/Apps/TplinkRouter' element={ <Private_Page.TplinkRouterAccounts /> } />
      <Route path='MyHomeLab/Apps/TplinkRouter/:accountId' element={ <Private_Page.TplinkRouterAccount /> } />
      <Route path='MyHomeLab/Apps/Coolify' element={ <Private_Page.CoolifyAccounts /> } />
      <Route path='MyHomeLab/Apps/Coolify/:accountId' element={ <Private_Page.CoolifyAccount /> } />
      <Route path='MyHomeLab/Apps/Dispatcharr' element={ <Private_Page.DispatcharrAccounts /> } />
      <Route path='MyHomeLab/Apps/Dispatcharr/:accountId' element={ <Private_Page.DispatcharrAccount /> } />
      <Route path='MyHomeLab/Apps/Jellyfin' element={ <Private_Page.JellyfinAccounts /> } />
      <Route path='MyHomeLab/Apps/Jellyfin/:accountId' element={ <Private_Page.JellyfinAccount /> } />
      <Route path='MyHomeLab/Apps/StirlingPDF' element={ <Private_Page.StirlingAccounts /> } />
      <Route path='MyHomeLab/Apps/StirlingPDF/:accountId' element={ <Private_Page.StirlingAccount /> } />
      <Route path='MyHomeLab/Apps/StirlingPDF/:accountId/Connections' element={ <Private_Page.StirlingConnections /> } />
      <Route path='MyHomeLab/Apps/Nextcloud/:accountId/Connections' element={ <Private_Page.NextcloudConnections /> } />
      <Route path='MyHomeLab/Apps/Gmail' element={ <Private_Page.Email /> } />
      <Route path='MyHomeLab/Apps/Gmail/Rules' element={ <Private_Page.EmailRules /> } />
      <Route path='MyHomeLab/Apps/Gmail/Connections' element={ <Private_Page.GmailConnections /> } />
      <Route path='MyHomeLab/Apps/Gmail/:accountId' element={ <Private_Page.GmailAccount /> } />
      <Route path='MyHomeLab/Apps/Gmail/:accountId/proposals' element={ <Private_Page.RuleProposals /> } />
      <Route path='MyHomeLab/Addons' element={ <Navigate to='/MyHomeLab/Apps' replace /> } />
      <Route path='MyHomeLab/Admin' element={ <Admin_Check><Private_Page.Admin /></Admin_Check> } />
      <Route path='MyHomeLab/Settings' element={ <Private_Page.Settings /> } />
      <Route path='MyHomeLab/Defeniçoes' element={ <Navigate to='/MyHomeLab/Settings' replace /> } />
      <Route path='MyHomeLab/Admin/Status' element={ <Admin_Check><Private_Page.SystemStatus /></Admin_Check> } />
      <Route path='MyHomeLab/Admin/Versions' element={ <Admin_Check><Private_Page.Versions /></Admin_Check> } />
      <Route path='*' element={ <Navigate to='/MyHomeLab' replace /> } />
    </Routes>
    </Suspense>
  );
};

export default Private_Routes;
