import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// Lazy load components for better performance
const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));

// Loading fallback component
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { isLoaded } = useUser();

  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="size-full">
        <Suspense fallback={<LoadingSpinner />}>
          <SignedOut>
            <Login />
          </SignedOut>
          <SignedIn>
            <Dashboard />
          </SignedIn>
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}