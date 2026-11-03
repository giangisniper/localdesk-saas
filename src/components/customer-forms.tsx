"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Dialog, Field, Input, Switch, Textarea, useToast } from "@/components/ui";
import { addNoteAction, deleteCustomerAction, deleteNoteAction, saveCustomerAction } from "@/app/actions/customers";

export interface CustomerValues { id?: string; name: string; email: string; phone: string; tags: string[]; marketingOptIn: boolean }

export function CustomerDialogButton({ customer, canDelete }: { customer?: CustomerValues; canDelete?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {customer ? <Button variant="secondary" onClick={() => setOpen(true)}><Pencil className="size-4" />Edit</Button> : <Button onClick={() => setOpen(true)}><Plus className="size-4" />Add customer</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={customer ? "Edit customer" : "Add customer"}>
        {open && <CustomerForm customer={customer} canDelete={canDelete} onClose={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function CustomerForm({ customer, canDelete, onClose }: { customer?: CustomerValues; canDelete?: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [v, setV] = useState<CustomerValues>(customer ?? { name: "", email: "", phone: "", tags: [], marketingOptIn: false });
  const [tags, setTags] = useState(v.tags.join(", "));
  const [error, setError] = useState<string>();
  const [fe, setFe] = useState<Record<string, string>>({});

  function save() {
    start(async () => {
      const r = await saveCustomerAction({ ...v, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
      if (r.ok) { toast(customer ? "Customer updated" : "Customer added"); onClose(); if (!customer && r.data) router.push(`/customers/${(r.data as { id: string }).id}`); else router.refresh(); return; }
      setError(r.error); setFe(r.fieldErrors ?? {});
    });
  }
  function remove() {
    if (!confirm("Delete this customer and all of their appointments? This can't be undone.")) return;
    start(async () => {
      const r = await deleteCustomerAction(customer!.id!);
      if (r.ok) { toast("Customer deleted"); router.push("/customers"); router.refresh(); } else setError(r.error);
    });
  }
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {error && <Alert>{error}</Alert>}
      <Field label="Full name" error={fe.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" error={fe.email}><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="Phone" error={fe.phone}><Input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
      </div>
      <Field label="Tags" error={fe.tags} hint="Comma-separated, e.g. VIP, Colour client"><Input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
      <Switch checked={v.marketingOptIn} onChange={(c) => setV({ ...v, marketingOptIn: c })} label="Marketing consent" description="The customer agreed to receive offers and news." />
      <div className="flex items-center justify-between border-t border-ink-100 pt-4">
        <div>{customer && canDelete && <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={remove} disabled={pending}><Trash2 className="size-4" />Delete</Button>}</div>
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={pending}>{customer ? "Save" : "Add customer"}</Button></div>
      </div>
    </form>
  );
}

export function NotesPanel({ customerId, notes }: { customerId: string; notes: { id: string; body: string; createdAt: string; author: string | null }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-4 px-5 pb-5">
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await addNoteAction({ customerId, body });
        if (r.ok) { setBody(""); setError(undefined); toast("Note added"); router.refresh(); } else setError(r.fieldErrors?.body ?? r.error);
      }); }}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a private note (preferences, allergies, reminders…)" aria-label="New note" maxLength={2000} />
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        <Button type="submit" size="sm" loading={pending}>Add note</Button>
      </form>
      {notes.length === 0 ? <p className="text-[13px] text-ink-500">No notes yet.</p> : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-lg bg-amber-50/70 p-3 text-sm">
              <p className="whitespace-pre-wrap text-ink-800">{n.body}</p>
              <div className="mt-1.5 flex items-center justify-between text-xs text-ink-500">
                <span>{n.author ?? "Former team member"} · {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                <button className="opacity-0 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100" onClick={() => start(async () => { await deleteNoteAction({ customerId, noteId: n.id }); router.refresh(); })} aria-label="Delete note">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
