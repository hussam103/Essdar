import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import TendersPage from "@/pages/tenders";
import TenderDetailsPage from "@/pages/tender-details";
import SavedTendersPage from "@/pages/saved-tenders";
import ProposalsPage from "@/pages/proposals";
import AnalyticsPage from "@/pages/analytics";
import SettingsPage from "@/pages/settings";
import LandingPage from "@/pages/landing-page";
import SubscriptionPage from "@/pages/subscription-page";
import AdminPage from "@/pages/admin";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { NotificationsProvider } from "./hooks/use-notifications";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/dashboard" component={Dashboard}/>
      <ProtectedRoute path="/tenders" component={TendersPage}/>
      <ProtectedRoute path="/tenders/:id" component={TenderDetailsPage}/>
      <ProtectedRoute path="/saved" component={SavedTendersPage}/>
      <ProtectedRoute path="/proposals" component={ProposalsPage}/>
      <ProtectedRoute path="/analytics" component={AnalyticsPage}/>
      <ProtectedRoute path="/settings" component={SettingsPage}/>
      <ProtectedRoute path="/subscribe/:plan" component={SubscriptionPage}/>
      <ProtectedRoute path="/admin" component={AdminPage}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationsProvider>
          <Router />
          <Toaster />
        </NotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
