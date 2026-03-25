import Card from "../ui/Card.jsx";
import TeamPanel from "./TeamPanel.jsx";

export default function TeamSectionCard({ canManage = false }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-6">
        <TeamPanel canManage={canManage} />
      </div>
    </Card>
  );
}