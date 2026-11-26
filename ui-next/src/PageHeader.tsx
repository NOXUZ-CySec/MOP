import type { ComponentProps, ReactNode, Ref } from "react";
import { ArrowLeft, ArrowLeftRight, BarChart3, CalendarDays, ClipboardList, FileDown, FilePlus2, FileSpreadsheet, FileText, LayoutDashboard, Plus, RefreshCw, Settings2, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./page-header.css";

const pageIcons = {
  home: LayoutDashboard, handover: ArrowLeftRight, records: FileText, schedule: CalendarDays,
  routines: ClipboardList, occurrences: TriangleAlert, reports: BarChart3, audit: ShieldCheck,
  users: Users, settings: Settings2, recordForm: FilePlus2,
};
const actionIcons = { refresh: RefreshCw, create: Plus, back: ArrowLeft, pdf: FileDown, excel: FileSpreadsheet };
type HeaderProps = {
  page: keyof typeof pageIcons;
  title: ReactNode;
  description?: ReactNode;
  titleId?: string;
  descriptionId?: string;
  titleRef?: Ref<HTMLHeadingElement>;
  titleTabIndex?: number;
  actions?: ReactNode;
};

export function PageHeader({ page, title, description, titleId, descriptionId, titleRef, titleTabIndex, actions }: HeaderProps) {
  const Icon = pageIcons[page];
  return <header className="mop-page-header" data-page={page}>
    <div className="mop-page-heading">
      <span className="mop-page-icon" aria-hidden="true"><Icon size={23} strokeWidth={2}/></span>
      <div className="mop-page-copy">
        <h1 id={titleId} ref={titleRef} tabIndex={titleTabIndex}>{title}</h1>
        {description && <p id={descriptionId}>{description}</p>}
      </div>
    </div>
    {actions && <div className="mop-page-actions">{actions}</div>}
  </header>;
}

type ActionProps = Omit<ComponentProps<typeof Button>, "variant" | "size"> & {
  kind: keyof typeof actionIcons;
  primary?: boolean;
};

export function PageAction({ kind, primary = false, className, children, ...props }: ActionProps) {
  const Icon = actionIcons[kind];
  return <Button type="button" variant={primary ? "default" : "outline"}
    className={className ? "mop-page-action " + className : "mop-page-action"}
    data-mop-action={primary ? "primary" : "secondary"} {...props}>
    <Icon aria-hidden="true" size={16} strokeWidth={2}/>{children}
  </Button>;
}
