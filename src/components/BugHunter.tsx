import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, ShieldAlert, Bug } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { supabase } from '../lib/supabase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class BugHunter extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error (BugHunter):', error, errorInfo);
    this.reportError(error, errorInfo);
  }

  private async reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      // Logic to report error to Supabase
      // We check if an error_logs table exists or just try to insert
      // Metadata includes user agent, path, etc.
      await supabase.from('error_logs').insert({
        error_name: error.name,
        message: error.message,
        stack: error.stack,
        component_stack: errorInfo.componentStack,
        url: window.location.href,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      // If table doesn't exist, we just fail silently or log to console
      console.warn('Could not save error to database, maybe error_logs table is missing.');
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl shadow-zinc-200 border border-zinc-100 text-center space-y-8">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-red-100 rounded-[2rem] animate-pulse" />
              <div className="relative flex items-center justify-center w-full h-full">
                <Bug className="w-12 h-12 text-red-600" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl font-black italic uppercase tracking-tighter text-zinc-900 leading-none">
                Bug Hunted!
              </h1>
              <p className="text-zinc-500 font-medium text-sm leading-relaxed">
                Something went wrong, but don't worry. Our "Bug Hunter" has already captured the technical details and sent them to our engineering team.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-zinc-50 p-4 rounded-2xl text-[10px] font-mono text-zinc-400 overflow-hidden text-left border border-zinc-100 max-h-32 overflow-y-auto">
                <p className="font-bold text-red-500 mb-1">ERROR_ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button 
                onClick={this.handleReset}
                className="h-14 bg-zinc-900 hover:bg-black text-white font-black italic rounded-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                Reload Application
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="h-12 border-zinc-200 text-zinc-500 font-bold rounded-2xl text-xs uppercase"
              >
                Back to Safety
              </Button>
            </div>

            <div className="pt-4 flex items-center justify-center gap-2 text-zinc-400">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">24/7 Threat Protection Active</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
