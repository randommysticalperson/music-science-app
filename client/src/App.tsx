/*
 * SoundLab App.tsx — Bauhaus Frequency Design
 * Routes: Home, MusicTheory, SignalProcessing, Acoustics
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import MusicTheory from "./pages/MusicTheory";
import SignalProcessing from "./pages/SignalProcessing";
import Acoustics from "./pages/Acoustics";
import Sequencer from "./pages/Sequencer";
import Layout from "./components/Layout";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/music-theory" component={MusicTheory} />
        <Route path="/signal-processing" component={SignalProcessing} />
        <Route path="/acoustics" component={Acoustics} />
        <Route path="/sequencer" component={Sequencer} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
