import OnTrack from "./ontrack";
import AuthGate from './auth-gate';
export default function Home() { return <AuthGate><OnTrack /></AuthGate>; }
