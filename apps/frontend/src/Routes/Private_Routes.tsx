import { Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import * as Private_Page from '../Imports/privatePages';
import Admin_Check from '../Authentication/Admin_Check';
import Legacy_Board_Redirect from './Legacy_Board_Redirect';
import Tasks_Entry from './Tasks_Entry';

const Private_Routes = () => {
  return (
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
      <Route path='MyHomeLab/Health/Sleep' element={ <Suspense fallback={null}><Private_Page.Sleep /></Suspense> } />
      <Route path='MyHomeLab/Health/Heart' element={ <Suspense fallback={null}><Private_Page.Heart /></Suspense> } />
      <Route path='MyHomeLab/Health/Skin' element={ <Suspense fallback={null}><Private_Page.Skin /></Suspense> } />
      <Route path='MyHomeLab/Health/Oxygen' element={ <Suspense fallback={null}><Private_Page.Oxygen /></Suspense> } />
      <Route path='MyHomeLab/Health/Stress' element={ <Suspense fallback={null}><Private_Page.Stress /></Suspense> } />
      <Route path='MyHomeLab/Health/Steps' element={ <Suspense fallback={null}><Private_Page.Steps /></Suspense> } />
      <Route path='MyHomeLab/Health/Exercise' element={ <Suspense fallback={null}><Private_Page.Exercise /></Suspense> } />
      <Route path='MyHomeLab/Health/Exercise/:workoutId' element={ <Suspense fallback={null}><Private_Page.Workout /></Suspense> } />
      <Route path='MyHomeLab/Health/Weight' element={ <Suspense fallback={null}><Private_Page.Weight /></Suspense> } />
      <Route path='MyHomeLab/Health/Water' element={ <Suspense fallback={null}><Private_Page.Water /></Suspense> } />
      <Route path='MyHomeLab/Health/Labs' element={ <Suspense fallback={null}><Private_Page.Labs /></Suspense> } />
      <Route path='MyHomeLab/Health/Labs/:reportId' element={ <Suspense fallback={null}><Private_Page.LabReport /></Suspense> } />
      <Route path='MyHomeLab/Health/Medication' element={ <Suspense fallback={null}><Private_Page.Medication /></Suspense> } />
      <Route path='MyHomeLab/Health/Diary' element={ <Suspense fallback={null}><Private_Page.Diary /></Suspense> } />
      <Route path='MyHomeLab/Health/Profile' element={ <Suspense fallback={null}><Private_Page.HealthProfile /></Suspense> } />
      <Route path='MyHomeLab/Health/Nutrition' element={ <Suspense fallback={null}><Private_Page.Nutrition /></Suspense> } />
      <Route path='MyHomeLab/Health/Body' element={ <Suspense fallback={null}><Private_Page.Body /></Suspense> } />
      <Route path='MyHomeLab/Health/Intakes' element={ <Suspense fallback={null}><Private_Page.Intakes /></Suspense> } />
      <Route path='MyHomeLab/Health/Wellbeing' element={ <Suspense fallback={null}><Private_Page.Wellbeing /></Suspense> } />
      <Route path='MyHomeLab/Health/Mood' element={ <Suspense fallback={null}><Private_Page.Mood /></Suspense> } />
      <Route path='MyHomeLab/Health/Fasting' element={ <Suspense fallback={null}><Private_Page.Fasting /></Suspense> } />
      <Route path='MyHomeLab/Servers' element={ <Private_Page.Servers /> } />
      <Route path='MyHomeLab/Docs' element={ <Suspense fallback={null}><Private_Page.Docs /></Suspense> } />
      <Route path='MyHomeLab/Docs/:docId' element={ <Suspense fallback={null}><Private_Page.Docs /></Suspense> } />
      <Route path='MyHomeLab/Docs/attempts/:attemptId' element={ <Suspense fallback={null}><Private_Page.Docs /></Suspense> } />
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
      <Route path='MyHomeLab/Apps/Trek/:accountId' element={ <Private_Page.TrekAccount /> } />
      <Route path='MyHomeLab/Apps/Trek/:accountId/Connections' element={ <Private_Page.TrekConnections /> } />
      <Route path='MyHomeLab/Apps/HomeAssistant' element={ <Private_Page.HomeAssistantAccounts /> } />
      <Route path='MyHomeLab/Apps/HomeAssistant/:accountId' element={ <Private_Page.HomeAssistantAccount /> } />
      <Route path='MyHomeLab/Apps/HomeAssistant/:accountId/Connections' element={ <Private_Page.HomeAssistantConnections /> } />
      <Route path='MyHomeLab/Apps/AdGuard' element={ <Private_Page.AdguardAccounts /> } />
      <Route path='MyHomeLab/Apps/AdGuard/:accountId' element={ <Private_Page.AdguardAccount /> } />
      <Route path='MyHomeLab/Apps/Proxmox' element={ <Private_Page.ProxmoxServers /> } />
      <Route path='MyHomeLab/Apps/Proxmox/:serverId' element={ <Private_Page.ProxmoxServer /> } />
      <Route path='MyHomeLab/Apps/Proxmox/:serverId/Connections' element={ <Private_Page.ProxmoxConnections /> } />
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
      <Route path='MyHomeLab/Apps/Nextcloud/:accountId/Connections' element={ <Private_Page.NextcloudConnections /> } />
      <Route path='MyHomeLab/Apps/Gmail' element={ <Private_Page.Email /> } />
      <Route path='MyHomeLab/Apps/Gmail/Rules' element={ <Private_Page.EmailRules /> } />
      <Route path='MyHomeLab/Apps/Gmail/Connections' element={ <Private_Page.GmailConnections /> } />
      <Route path='MyHomeLab/Apps/Gmail/:accountId' element={ <Private_Page.GmailAccount /> } />
      <Route path='MyHomeLab/Apps/Gmail/:accountId/proposals' element={ <Private_Page.RuleProposals /> } />
      <Route path='MyHomeLab/Addons' element={ <Navigate to='/MyHomeLab/Apps' replace /> } />
      <Route path='MyHomeLab/Admin' element={ <Admin_Check><Private_Page.Admin /></Admin_Check> } />
      <Route path='MyHomeLab/Defeniçoes' element={ <Private_Page.Settings /> } />
      <Route path='MyHomeLab/Admin/Status' element={ <Admin_Check><Private_Page.SystemStatus /></Admin_Check> } />
      <Route path='MyHomeLab/Admin/Versions' element={ <Admin_Check><Private_Page.Versions /></Admin_Check> } />
      <Route path='*' element={ <Navigate to='/MyHomeLab' replace /> } />
    </Routes>
  );
};

export default Private_Routes;
