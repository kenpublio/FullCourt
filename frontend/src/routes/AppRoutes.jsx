import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Layouts
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';

// Pages
const Login = lazy(() => import('../pages/Login'));
const AdminLogin = lazy(() => import('../pages/AdminLogin'));
const Register = lazy(() => import('../pages/Register'));
const Home = lazy(() => import('../pages/Home'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const UserManagement = lazy(() => import('../pages/UserManagement'));
const Profile = lazy(() => import('../pages/Profile'));
const NotFound = lazy(() => import('../pages/NotFound'));
const TournamentManagement = lazy(() => import('../pages/TournamentManagement'));
const TeamManagement = lazy(() => import('../pages/TeamManagement'));
const EligibilityVerification = lazy(() => import('../pages/EligibilityVerification'));
const BracketEngineView = lazy(() => import('../pages/BracketEngineView'));
const ScheduleOptimizerView = lazy(() => import('../pages/ScheduleOptimizerView'));
const LiveScoringView = lazy(() => import('../pages/LiveScoringView'));
const BasketballStatistician = lazy(() => import('../pages/BasketballStatistician'));
const PaymentVerificationView = lazy(() => import('../pages/PaymentVerificationView'));
const QRAttendanceView = lazy(() => import('../pages/QRAttendanceView'));
const GameDayOperations = lazy(() => import('../pages/GameDayOperations'));
const ReportsAnalyticsView = lazy(() => import('../pages/ReportsAnalyticsView'));
const StandingsView = lazy(() => import('../pages/StandingsView'));
const NotificationsView = lazy(() => import('../pages/NotificationsView'));
const SettingsView = lazy(() => import('../pages/SettingsView'));
const PublicSportsPortal = lazy(() => import('../pages/PublicSportsPortal'));
const PublicTournamentDetails = lazy(() => import('../pages/PublicTournamentDetails'));
const VenueManagement = lazy(() => import('../pages/VenueManagement'));
const SportsHistory = lazy(() => import('../pages/SportsHistory'));
const PlayerPayments = lazy(() => import('../pages/PlayerPayments'));
const OrganizationManagement = lazy(() => import('../pages/OrganizationManagement'));
const OfficialsWorkspace = lazy(() => import('../pages/OfficialsWorkspace'));
const AwardsManagement = lazy(() => import('../pages/AwardsManagement'));
const PublicOrganizationPortal = lazy(() => import('../pages/PublicOrganizationPortal'));
const ShareCards = lazy(() => import('../pages/ShareCards'));
const PlayerAnalytics = lazy(() => import('../pages/PlayerAnalytics'));
const PlayerDocuments = lazy(() => import('../pages/PlayerDocuments'));
const TeamAnalytics = lazy(() => import('../pages/TeamAnalytics'));
const BroadcastOverlay = lazy(() => import('../pages/BroadcastOverlay'));
const CoachDashboard = lazy(() => import('../pages/CoachDashboard'));
const LegalPage = lazy(() => import('../pages/LegalPage'));
const PublicGameDetails = lazy(() => import('../pages/PublicGameDetails'));
const PublicDailySchedule = lazy(() => import('../pages/PublicDailySchedule'));

// Guard
import ProtectedRoute from './ProtectedRoute';

const AppRoutes = () => {
  return (
    <Suspense fallback={<div className="app-loading" role="status">Loading FullCourt…</div>}>
    <Routes>
      {/* Auth Public Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="/admin" element={<AdminLogin />} />

      {/* Protected App Routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/organizations" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer']}><OrganizationManagement /></ProtectedRoute>} />
        <Route path="/officials" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','official','statistician']}><OfficialsWorkspace /></ProtectedRoute>} />
        <Route path="/awards" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer']}><AwardsManagement /></ProtectedRoute>} />
        <Route path="/share-cards" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer']}><ShareCards /></ProtectedRoute>} />
        <Route path="/player/performance" element={<ProtectedRoute allowedRoles={['player']}><PlayerAnalytics /></ProtectedRoute>} />
        <Route path="/player/documents" element={<ProtectedRoute allowedRoles={['player']}><PlayerDocuments /></ProtectedRoute>} />
        <Route path="/players/:id" element={<PlayerAnalytics />} />
        <Route path="/teams/:teamId/stats" element={<TeamAnalytics />} />
        <Route path="/organizer" element={<ProtectedRoute allowedRoles={['organization_admin','tournament_organizer']}><Dashboard /></ProtectedRoute>} />
        <Route path="/organizer/setup" element={<ProtectedRoute allowedRoles={['organization_admin','tournament_organizer']}><OrganizationManagement /></ProtectedRoute>} />
        <Route path="/organizer/tools" element={<ProtectedRoute allowedRoles={['organization_admin','tournament_organizer']}><ShareCards /></ProtectedRoute>} />
        <Route path="/platform" element={<ProtectedRoute allowedRoles={['platform_admin','admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="/player" element={<ProtectedRoute allowedRoles={['player']}><Dashboard /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute allowedRoles={['coach','coach_manager']}><CoachDashboard /></ProtectedRoute>} />
        <Route path="/official" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','official']}><OfficialsWorkspace /></ProtectedRoute>} />
        <Route path="/statistician" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','statistician']}><BasketballStatistician /></ProtectedRoute>} />
        <Route path="/games/:gameId/live" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','statistician']}><LiveScoringView /></ProtectedRoute>} />
        
        <Route path="/tournaments" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']}><TournamentManagement /></ProtectedRoute>} />
        <Route path="/teams" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']}><TeamManagement /></ProtectedRoute>} />
        <Route path="/eligibility" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']}><EligibilityVerification /></ProtectedRoute>} />
        <Route path="/brackets" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer']}><BracketEngineView /></ProtectedRoute>} />
        <Route path="/schedules" element={<ScheduleOptimizerView />} />
        <Route path="/venues" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer']}><VenueManagement /></ProtectedRoute>} />
        <Route path="/live-scoring" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','statistician']}><LiveScoringView /></ProtectedRoute>} />
        <Route path="/scorekeeper" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','statistician']}><BasketballStatistician /></ProtectedRoute>} />
        <Route path="/standings" element={<StandingsView />} />
        <Route path="/payments" element={<ProtectedRoute allowedRoles={['admin','finance_officer','coach_manager']}><PaymentVerificationView /></ProtectedRoute>} />
        <Route path="/qr-attendance" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']}><QRAttendanceView /></ProtectedRoute>} />
        <Route path="/game-day" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer']}><GameDayOperations /></ProtectedRoute>} />
        <Route path="/notifications" element={<NotificationsView />} />
        <Route path="/history" element={<ProtectedRoute allowedRoles={['player']}><SportsHistory /></ProtectedRoute>} />
        <Route path="/my-payments" element={<ProtectedRoute allowedRoles={['player']}><PlayerPayments /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']}><ReportsAnalyticsView /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager','player']}><SettingsView /></ProtectedRoute>} />
      </Route>

      {/* Root & Fallback */}
      <Route path="/" element={<Home />} />
      <Route path="/sports" element={<PublicSportsPortal />} />
      <Route path="/sports/schedule" element={<PublicDailySchedule />} />
      <Route path="/sports/categories" element={<PublicSportsPortal />} />
      <Route path="/sports/tournaments/:id" element={<PublicTournamentDetails />} />
      <Route path="/sports/games/:gameId" element={<PublicGameDetails />} />
      <Route path="/public/:slug" element={<PublicOrganizationPortal />} />
      <Route path="/overlay/game/:gameId" element={<BroadcastOverlay />} />
      <Route path="/legal/:document" element={<LegalPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

export default AppRoutes;
