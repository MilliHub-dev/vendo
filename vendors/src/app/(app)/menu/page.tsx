"use client";

import { Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";

import { useDeleteMenuItem, useMenu, useSaveMenuItem, useSetItemAvailable } from "@/api/queries";
import type { MenuItem } from "@/api/types";
import { ImagePicker } from "@/components/ImagePicker";
import { Badge, Button, Confirm, Empty, Input, Modal, Spinner, Switch, Textarea } from "@/components/ui";
import { formatNaira, nairaToKobo } from "@/lib/money";

export default function MenuPage() {
  const menu = useMenu();
  const setAvailable = useSetItemAvailable();
  const remove = useDeleteMenuItem();
  const [filter, setFilter] = useState("All");
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  if (menu.isError) return <p className="note note--danger">{menu.error?.message}</p>;
  if (!menu.data) return <Spinner />;

  const items = menu.data;
  const categories = Array.from(new Set(items.map((m) => m.category)));
  const shown = filter === "All" || !categories.includes(filter) ? items : items.filter((m) => m.category === filter);
  const off = items.filter((m) => !m.isAvailable).length;

  return (
    <>
      <div className="between" style={{ flexWrap: "wrap" }}>
        <div className="wrap" role="tablist" aria-label="Menu category">
          {["All", ...categories].map((c) => (
            <button key={c} type="button" role="tab" className="chip" aria-selected={filter === c} onClick={() => setFilter(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="row">
          <span className="small muted">
            {items.length} item{items.length === 1 ? "" : "s"}
            {off ? ` · ${off} sold out` : ""}
          </span>
          <Button onClick={() => setEditing("new")}>
            <Plus /> Add item
          </Button>
        </div>
      </div>

      <section className="card card--flush">
        {items.length === 0 ? (
          <Empty icon={<UtensilsCrossed />} title="Your menu is empty" action={<Button onClick={() => setEditing("new")}>Add your first item</Button>}>
            Add the dishes or products you sell. You need at least one item before you can open your store.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="num">Price</th>
                  <th>Available</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="row">
                        <span className="thumb" aria-hidden style={item.isAvailable ? undefined : { opacity: 0.45 }}>
                          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.emoji}
                        </span>
                        <div className="grow">
                          <div className="strong">{item.name}</div>
                          <div className="small muted">{item.description}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Category">
                      <Badge>{item.category}</Badge>
                    </td>
                    <td className="num strong" data-label="Price">
                      {formatNaira(item.priceKobo)}
                    </td>
                    <td>
                      <div className="row">
                        <Switch checked={item.isAvailable} onChange={(available) => setAvailable.mutate({ id: item.id, available })} label={`${item.name} available`} />
                        <span className={item.isAvailable ? "small text-success" : "small subtle"}>{item.isAvailable ? "Available" : "Sold out"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <button type="button" className="icon-btn" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}>
                          <Pencil />
                        </button>
                        <button type="button" className="icon-btn" aria-label={`Remove ${item.name} from sale`} onClick={() => setDeleting(item)}>
                          <Trash2 color="var(--danger)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing ? <ItemModal existing={editing === "new" ? undefined : editing} categories={categories} onClose={() => setEditing(null)} /> : null}
      {deleting ? (
        <Confirm
          title={`Remove “${deleting.name}” from sale?`}
          message="It will become unavailable to customers. You can make it available again later."
          confirmLabel="Remove from sale"
          danger
          loading={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        />
      ) : null}
    </>
  );
}

function ItemModal({ existing, categories, onClose }: { existing?: MenuItem; categories: string[]; onClose: () => void }) {
  const save = useSaveMenuItem();
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [price, setPrice] = useState(existing ? String(existing.priceKobo / 100) : "");
  const [category, setCategory] = useState(existing?.category ?? categories[0] ?? "");
  const emoji = "🍽️";
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl);
  const [isAvailable, setAvailable] = useState(existing?.isAvailable ?? true);
  const [touched, setTouched] = useState(false);

  const naira = Number(price) || 0;
  const errors = {
    name: name.trim().length < 2 ? "Enter the item name" : null,
    price: !price.trim() || !Number.isFinite(naira) || naira < 0 || nairaToKobo(naira) > 1000000000 ? "Enter a valid price up to ₦10,000,000" : null,
    category: !category.trim() ? "Choose or type a category" : null,
  };
  const submit = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    save.mutate({ id: existing?.id, item: { name, description, priceKobo: nairaToKobo(naira), category, isAvailable, emoji, imageUrl } }, { onSuccess: onClose });
  };

  return (
    <Modal
      wide
      title={existing ? "Edit item" : "New menu item"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            {existing ? "Save changes" : "Add to menu"}
          </Button>
        </>
      }>
      <Input label="Name" placeholder="e.g. Jollof Rice & Chicken" maxLength={50} autoFocus value={name} onChange={(e) => setName(e.target.value)} error={touched ? errors.name : null} />
      <Textarea label="Description (optional)" placeholder="What’s in it? Portion size?" maxLength={160} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="form-grid">
        <Input label="Price" prefix="₦" placeholder="0" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} error={touched ? errors.price : null} />
        <div>
          <Input label="Category" placeholder="e.g. Rice, Swallow, Drinks" maxLength={24} list="menu-categories" value={category} onChange={(e) => setCategory(e.target.value)} error={touched ? errors.category : null} hint={categories.length ? "Pick an existing one or type a new one" : undefined} />
          <datalist id="menu-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      <ImagePicker kind="menu_item" label="Photo" hint="A clear photo of the dish. JPEG, PNG or WebP." value={imageUrl} onChange={(url) => setImageUrl(url ?? undefined)} placeholder={<span aria-hidden>{emoji}</span>} />
      <label className="between note" style={{ cursor: "pointer" }}>
        <span>
          <span className="strong">Available</span>
          <br />
          <span className="small">Turn off when it’s sold out; customers won’t be able to order it.</span>
        </span>
        <Switch checked={isAvailable} onChange={setAvailable} label="Available" />
      </label>
      {save.isError ? <p className="text-danger">{save.error.message}</p> : null}
    </Modal>
  );
}
