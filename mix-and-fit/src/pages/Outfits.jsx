import { useEffect, useState } from "react";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { thumbnail } from "../cloudinary";
import { OUTFIT_CATEGORIES, formatPrice } from "../config";

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function Outfits() {
    const { user } = useAuth();
    const [clothes, setClothes] = useState([]);
    const [outfits, setOutfits] = useState([]);
    const [name, setName] = useState("");
    const [category, setCategory] = useState(OUTFIT_CATEGORIES[0]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [onlyFavorites, setOnlyFavorites] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");

    // Live list of the user's clothes
    useEffect(() => {
        const q = query(collection(db, "clothes"), where("ownerId", "==", user.uid));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setClothes(list);
            },
            () => setError("Could not load your closet.")
        );
        return unsubscribe;
    }, [user.uid]);

    // Live list of the user's outfits
    useEffect(() => {
        const q = query(collection(db, "outfits"), where("ownerId", "==", user.uid));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                const now = Date.now() / 1000;
                list.sort(
                    (a, b) => (b.createdAt?.seconds || now) - (a.createdAt?.seconds || now)
                );
                setOutfits(list);
            },
            () => setError("Could not load your outfits.")
        );
        return unsubscribe;
    }, [user.uid]);

    const clothesById = {};
    clothes.forEach((c) => {
        clothesById[c.id] = c;
    });

    // Worth of an outfit: only known prices are added up
    function outfitWorth(outfit) {
        let total = 0;
        let unknown = 0;
        let removed = 0;
        (outfit.itemIds || []).forEach((id) => {
            const item = clothesById[id];
            if (!item) {
                removed += 1;
            } else if (item.price === null || item.price === undefined) {
                unknown += 1;
            } else {
                total += item.price;
            }
        });
        return { total, unknown, removed };
    }

    function toggleItem(id) {
        setSelectedIds((current) =>
            current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
        );
    }

    function resetForm() {
        setName("");
        setCategory(OUTFIT_CATEGORIES[0]);
        setSelectedIds([]);
        setEditingId(null);
    }

    async function handleSave(event) {
        event.preventDefault();
        setError("");
        setInfo("");
        if (selectedIds.length === 0) {
            setError("Pick at least one item for the outfit.");
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                await updateDoc(doc(db, "outfits", editingId), {
                    name: name,
                    category: category,
                    itemIds: selectedIds,
                });
            } else {
                await addDoc(collection(db, "outfits"), {
                    ownerId: user.uid,
                    name: name,
                    category: category,
                    itemIds: selectedIds,
                    favorite: false,
                    createdAt: serverTimestamp(),
                });
            }
            resetForm();
        } catch (err) {
            setError("Could not save the outfit: " + (err.message || err.code));
        } finally {
            setSaving(false);
        }
    }

    function handleEdit(outfit) {
        setEditingId(outfit.id);
        setName(outfit.name || "");
        setCategory(outfit.category || OUTFIT_CATEGORIES[0]);
        // keep only items that still exist
        setSelectedIds((outfit.itemIds || []).filter((id) => clothesById[id]));
        setError("");
        setInfo("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function handleDelete(id) {
        if (!window.confirm("Delete this outfit?")) return;
        try {
            await deleteDoc(doc(db, "outfits", id));
            if (editingId === id) resetForm();
        } catch (err) {
            setError("Could not delete the outfit (" + err.code + ").");
        }
    }

    async function toggleFavorite(outfit) {
        try {
            await updateDoc(doc(db, "outfits", outfit.id), {
                favorite: !outfit.favorite,
            });
        } catch (err) {
            setError("Could not update the favorite (" + err.code + ").");
        }
    }

    // Random outfit: a dress OR a top + bottom, then shoes, outerwear, accessory
    function handleRandom() {
        setError("");
        const byCategory = (cat) => clothes.filter((i) => i.category === cat);
        const dresses = byCategory("Dresses");
        const tops = byCategory("Tops");
        const bottoms = byCategory("Bottoms");

        const picks = [];
        const canDress = dresses.length > 0;
        const canTwoPiece = tops.length > 0 && bottoms.length > 0;

        if (canDress && (!canTwoPiece || Math.random() < 0.5)) {
            picks.push(pickRandom(dresses));
        } else if (canTwoPiece) {
            picks.push(pickRandom(tops));
            picks.push(pickRandom(bottoms));
        }

        ["Shoes", "Outerwear", "Accessories"].forEach((cat) => {
            const options = byCategory(cat);
            if (options.length > 0) picks.push(pickRandom(options));
        });

        if (picks.length === 0) {
            setInfo("");
            setError("Add more clothes to your closet first (a dress, or a top and a bottom).");
            return;
        }
        setSelectedIds(picks.map((p) => p.id));
        setInfo("Here is a random outfit. Give it a name and save it, or press the button again.");
    }

    const visibleOutfits = onlyFavorites ? outfits.filter((o) => o.favorite) : outfits;

    return (
        <div>
            <h1>My outfits</h1>

            <div className="card">
                <h3>{editingId ? "Edit outfit" : "Create an outfit"}</h3>
                <form onSubmit={handleSave}>
                    <div className="form-row">
                        <input
                            type="text"
                            placeholder="Outfit name (e.g. Friday brunch)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                        <select value={category} onChange={(e) => setCategory(e.target.value)}>
                            {OUTFIT_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                        <button type="submit" disabled={saving}>
                            {saving ? "Saving..." : editingId ? "Save changes" : "Save outfit"}
                        </button>
                    </div>

                    <div className="spaced">
                        <button type="button" className="btn-ghost btn-small" onClick={handleRandom}>
                            Surprise me
                        </button>{" "}
                        {editingId && (
                            <button type="button" className="btn-ghost btn-small" onClick={resetForm}>
                                Cancel editing
                            </button>
                        )}
                    </div>
                </form>

                <p className="muted spaced">
                    Click items to add or remove them ({selectedIds.length} selected).
                </p>

                {clothes.length === 0 ? (
                    <p className="empty">Your closet is empty. Add clothes in the Closet page first.</p>
                ) : (
                    <div className="grid">
                        {clothes.map((item) => {
                            const selected = selectedIds.includes(item.id);
                            return (
                                <div
                                    className="card item-card"
                                    key={item.id}
                                    onClick={() => toggleItem(item.id)}
                                    style={{
                                        cursor: "pointer",
                                        outline: selected ? "3px solid var(--text)" : "none",
                                    }}
                                >
                                    {item.imageURL ? (
                                        <img
                                            className="item-photo-img"
                                            src={thumbnail(item.imageURL)}
                                            alt={item.name}
                                        />
                                    ) : (
                                        <div className="item-photo">{item.name.charAt(0).toUpperCase()}</div>
                                    )}
                                    <div className="item-body">
                                        <h3>{item.name}</h3>
                                        <span className="tag">{item.category}</span>
                                        {selected && <p className="muted">Selected</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {error && <p className="error">{error}</p>}
            {info && <p className="notice">{info}</p>}

            <h2>Saved outfits</h2>
            <label className="check">
                <input
                    type="checkbox"
                    checked={onlyFavorites}
                    onChange={(e) => setOnlyFavorites(e.target.checked)}
                />
                Show only favorites
            </label>

            {visibleOutfits.length === 0 ? (
                <p className="empty">
                    {onlyFavorites
                        ? "No favorite outfits yet."
                        : "No outfits yet. Create your first one above."}
                </p>
            ) : (
                <div className="grid">
                    {visibleOutfits.map((outfit) => {
                        const worth = outfitWorth(outfit);
                        return (
                            <div className="card" key={outfit.id}>
                                <h3>
                                    {outfit.favorite ? "♥ " : ""}
                                    {outfit.name}
                                </h3>
                                {outfit.category && <span className="tag">{outfit.category}</span>}

                                <div className="spaced">
                                    {(outfit.itemIds || []).map((id) => {
                                        const item = clothesById[id];
                                        if (!item) {
                                            return (
                                                <p className="muted" key={id}>
                                                    Item removed
                                                </p>
                                            );
                                        }
                                        return (
                                            <div key={id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                {item.imageURL ? (
                                                    <img
                                                        src={thumbnail(item.imageURL)}
                                                        alt={item.name}
                                                        style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }}
                                                    />
                                                ) : (
                                                    <div className="item-photo" style={{ width: 40, height: 40 }}>
                                                        {item.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span>{item.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <p className="spaced">
                                    <strong>Worth: {formatPrice(worth.total)}</strong>
                                </p>
                                {worth.unknown > 0 && (
                                    <p className="muted">{worth.unknown} item(s) without price</p>
                                )}
                                {worth.removed > 0 && (
                                    <p className="muted">{worth.removed} item(s) removed from your closet</p>
                                )}

                                <div className="item-actions">
                                    <button className="btn-ghost btn-small" onClick={() => toggleFavorite(outfit)}>
                                        {outfit.favorite ? "Unfavorite" : "Favorite"}
                                    </button>
                                    <button className="btn-ghost btn-small" onClick={() => handleEdit(outfit)}>
                                        Edit
                                    </button>
                                    <button className="btn-ghost btn-small" onClick={() => handleDelete(outfit.id)}>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Outfits;