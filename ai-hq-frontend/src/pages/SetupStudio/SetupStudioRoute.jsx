import SetupStudioShell from "./SetupStudioShell.jsx";
import SetupStudioScreen from "./SetupStudioScreen.jsx";

export default function SetupStudioRoute() {
  return (
    <SetupStudioShell>
      <SetupStudioScreen />
    </SetupStudioShell>
  );
}