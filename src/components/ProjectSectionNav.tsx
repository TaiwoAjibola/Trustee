const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "milestones", label: "Milestones" },
  { id: "investors", label: "Investors" },
  { id: "monitors", label: "Monitors" },
  { id: "transactions", label: "Transactions" },
  { id: "documents", label: "Documents" },
  { id: "communications", label: "Communications" },
  { id: "activity", label: "Activity & audit" },
];

export function ProjectSectionNav() {
  return (
    <nav className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200">
      <div className="flex gap-1 overflow-x-auto text-xs font-semibold text-slate-500">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 px-3 py-1.5 rounded-md hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200"
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
