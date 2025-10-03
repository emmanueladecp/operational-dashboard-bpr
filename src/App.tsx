import { SignedIn, SignedOut } from '@clerk/clerk-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  return (
    <div className="size-full">
      <SignedOut>
        <Login />
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </div>
  );
}