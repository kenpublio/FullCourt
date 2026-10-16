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
const OfficialsWorkspace = lazy(() => import('../pages/OfficialsWorkspace'));
const AwardsManagement = lazy(() => import('../pages/AwardsManagement'));
const ShareCards = lazy(() => import('../pages/ShareCards'));
const TeamAnalytics = lazy(() => import('../pages/TeamAnalytics'));
const BroadcastOverlay = lazy(() => import('../pages/BroadcastOverlay'));
const CoachDashboard = lazy(() => import('../pages/CoachDashboard'));
const LegalPage = lazy(() => import('../pages/LegalPage'));
const PublicGameDetails = lazy(() => import('../pages/PublicGameDetails'));
const PublicDailySchedule = lazy(() => import('../pages/PublicDailySchedule'));
const GuestScoringConsole = lazy(() => import('../pages/GuestScoringConsole'));

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
            <ProtectedRoute allowedRoles={['platform_admin','admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/officials" element={<ProtectedRoute allowedRoles={['platform_admin','admin','statistician']}><OfficialsWorkspace /></ProtectedRoute>} />
        <Route path="/awards" element={<ProtectedRoute allowedRoles={['platform_admin','admin']}><AwardsManagement /></ProtectedRoute>} />
        <Route path="/share-cards" element={<ProtectedRoute allowedRoles={['platform_admin','admin']}><ShareCards /></ProtectedRoute>} />
        <Route path="/teams/:teamId/stats" element={<TeamAnalytics />} />
        <Route path="/platform" element={<ProtectedRoute allowedRoles={['platform_admin','admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute allowedRoles={['coach']}><CoachDashboard /></ProtectedRoute>} />
        <Route path="/statistician" element={<ProtectedRoute allowedRoles={['platform_admin','admin','statistician']}><BasketballStatistician /></ProtectedRoute>} />
        <Route path="/games/:gameId/live" element={<ProtectedRoute allowedRoles={['platform_admin','admin','statistician']}><LiveScoringView /></ProtectedRoute>} />
        
        <Route path="/tournaments" element={<ProtectedRoute allowedRoles={['platform_admin','admin','coach','statistician']}><TournamentManagement /></ProtectedRoute>} />
        <Route path="/teams" element={<ProtectedRoute allowedRoles={['platform_admin','admin','coach','statistician']}><TeamManagement /></ProtectedRoute>} />
        <Route path="/eligibility" element={<ProtectedRoute allowedRoles={['platform_admin','admin','coach']}><EligibilityVerification /></ProtectedRoute>} />
        <Route path="/brackets" element={<ProtectedRoute allowedRoles={['platform_admin','admin','statistician']}><BracketEngineView /></ProtectedRoute>} />
        <Route path="/schedules" element={<ScheduleOptimizerView />} />
        <Route path="/venues" element={<ProtectedRoute allowedRoles={['platform_admin','admin']}><VenueManagement /></ProtectedRoute>} />
        <Route path="/live-scoring" element={<ProtectedRoute allowedRoles={['platform_admin','admin','statistician']}><LiveScoringView /></ProtectedRoute>} />
        <Route path="/scorekeeper" element={<ProtectedRoute allowedRoles={['platform_admin','admin','statistician']}><BasketballStatistician /></ProtectedRoute>} />
        <Route path="/standings" element={<StandingsView />} />
        <Route path="/payments" element={<ProtectedRoute allowedRoles={['platform_admin','admin','coach']}><PaymentVerificationView /></ProtectedRoute>} />
        <Route path="/qr-attendance" element={<ProtectedRoute allowedRoles={['platform_admin','admin','coach']}><QRAttendanceView /></ProtectedRoute>} />
        <Route path="/game-day" element={<ProtectedRoute allowedRoles={['platform_admin','admin']}><GameDayOperations /></ProtectedRoute>} />
        <Route path="/notifications" element={<NotificationsView />} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={['platform_admin','admin','coach']}><ReportsAnalyticsView /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={['platform_admin','admin','coach']}><SettingsView /></ProtectedRoute>} />
      </Route>

      {/* Root & Fallback */}
      <Route path="/" element={<Home />} />
      <Route path="/sports" element={<PublicSportsPortal />} />
      <Route path="/sports/schedule" element={<PublicDailySchedule />} />
      <Route path="/sports/categories" element={<PublicSportsPortal />} />
      <Route path="/sports/tournaments/:id" element={<PublicTournamentDetails />} />
      <Route path="/sports/games/:gameId" element={<PublicGameDetails />} />
      <Route path="/score/:token" element={<GuestScoringConsole />} />
      <Route path="/overlay/game/:gameId" element={<BroadcastOverlay />} />
      <Route path="/legal/:document" element={<LegalPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

export default AppRoutes;
