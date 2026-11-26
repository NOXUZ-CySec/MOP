import { useState } from "react";
import { Tabs } from "radix-ui";
import { Clipboard, Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OperationalRecord } from "./RecordsPage";
import { recordDateTime } from "./components/records1097/recordQuery";

type Props = {
  record: OperationalRecord;
  blocked: boolean;
  canEdit: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: (trigger: HTMLButtonElement) => void;
  onCopyResult: (message: string) => void;
};

export default function RecordDetail({ record, blocked, canEdit, canDuplicate, canDelete, onEdit, onDuplicate, onDelete, onCopyResult }: Props) {
  const [tab, setTab] = useState("summary");
  const copyProtocol = async () => {
    try {
      await navigator.clipboard.writeText(record.id);
      onCopyResult("Protocolo copiado.");
    } catch {
      onCopyResult("Não foi possível copiar o protocolo.");
    }
  };

  return <>
    <header className="mop-record-detail-heading">
      <div><p className="mop-record-protocol">{record.id}</p><h2>{record.title}</h2></div>
      <span className={"records-status " + record.status.replaceAll(" ", "-")}>{record.status}</span>
    </header>
    <div className="mop-record-actions">
      {canEdit && <Button type="button" size="sm" disabled={blocked} onClick={onEdit}><Pencil/>Editar</Button>}
      <Button type="button" size="sm" variant="outline" onClick={() => void copyProtocol()}><Clipboard/>Copiar protocolo</Button>
      {canDuplicate && <Button type="button" size="sm" variant="outline" disabled={blocked} onClick={onDuplicate}><Copy/>Duplicar</Button>}
    </div>
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List className="mop-record-tabs" aria-label="Detalhes do registro">
        <Tabs.Trigger value="summary">Resumo</Tabs.Trigger>
        <Tabs.Trigger value="continuity">Continuidade</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="summary" className="mop-record-tab">
        <dl className="mop-record-facts">
          <div><dt>Condomínio</dt><dd>{record.condo}</dd></div>
          <div><dt>Categoria</dt><dd>{record.category}</dd></div>
          <div><dt>Registrado em</dt><dd>{recordDateTime(record.occurredAt)}</dd></div>
          <div><dt>Registrado por</dt><dd>{record.author}</dd></div>
        </dl>
        <section className="mop-record-copy"><h3>Descrição</h3><p>{record.description || record.details || "Não informada"}</p></section>
      </Tabs.Content>
      <Tabs.Content value="continuity" className="mop-record-tab">
        <dl className="mop-record-facts">
          <div><dt>Prioridade</dt><dd>{record.priority || "Não informada"}</dd></div>
          <div><dt>Prazo</dt><dd>{record.deadline ? recordDateTime(record.deadline) : "Não informado"}</dd></div>
          <div><dt>Responsável pelo acompanhamento</dt><dd>{record.assignee || "Não informado"}</dd></div>
          {record.updatedAt && <div><dt>Última atualização</dt><dd>{recordDateTime(record.updatedAt)}</dd></div>}
        </dl>
        <section className="mop-record-copy"><h3>Providências registradas</h3><p>{record.actionTaken || "Não informadas"}</p></section>
        <section className="mop-record-copy"><h3>Próxima ação</h3><p>{record.nextAction || "Não informada"}</p></section>
      </Tabs.Content>
    </Tabs.Root>
    {canDelete && <div className="mop-record-delete">
      <Button type="button" size="sm" variant="outline" disabled={blocked} onClick={event => onDelete(event.currentTarget)}><Trash2/>Excluir registro</Button>
    </div>}
  </>;
}
