import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
interface Nutrition {
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
}

interface Recipe {
  id: number;
  name: string;
  description: string;
  image: string;
  nutrition: Nutrition;
  price: number;
  maxFlavors?: number; // how many flavor choices allowed
}

interface MoreRecipe {
  name: string;
  time: string;
  img: string;
}

interface CartItem extends Recipe {
  quantity: number;
  selectedFlavors?: string[];
}

const FLAVORS = [
  { name: "Classic", color: "#000000",},
  { name: "Honey Garlic", color: "#000000",},
  { name: "Teriyaki", color: "#000000",},
  { name: "Texas BBQ", color: "#000000",},
  { name: "Garlic Parmesan", color: "#000000",},
  { name: "K-Style", color: "#000000",},
  { name: "Spicy K-Style", color: "#000000",  },
];

const recipes: Record<string, Recipe[]> = {
  Chicken: [
    {
      id: 1,
      name: "Whole Crispy Fried Chicken",
      description: "12 pcs | Perfect for 4-6 pax (Choice of 2 Flavors)",
      image: "https://bit.ly/4ckRqHY",
      nutrition: { calories: 350, protein: 15, fats: 25, carbs: 90 },
      price: 598,
      maxFlavors: 2,
    },
    {
      id: 2,
      name: "Half Crispy Fried Chicken",
      description: "6 pcs | Perfect for 2-3 pax. (Choice of 1 Flavor)",
      image: "https://bit.ly/3P8sz0j",
      nutrition: { calories: 350, protein: 15, fats: 25, carbs: 90 },
      price: 328,
      maxFlavors: 1,
    },
    {
      id: 3,
      name: "Crispy Chicken Shots with Drink",
      description: "Good For 1 Pax.",
      image: "https://bit.ly/3P6DcAK",
      nutrition: { calories: 235, protein: 11, fats: 30, carbs: 60 },
      price: 128,
      maxFlavors: 1,
    },
    {
      id: 4,
      name: "Chicken Skin with Rice and Drink",
      description: "Solo Meal.",
      image: "https://bit.ly/3P6DcAK",
      nutrition: { calories: 280, protein: 34, fats: 14, carbs: 5 },
      price: 118,
      maxFlavors: 1,
    },
    {
      id: 5,
      name: "2 pcs. Chicken With Rice and Drink",
      description: "Solo Meal.",
      image: "https://bit.ly/4r5rfZI",
      nutrition: { calories: 280, protein: 34, fats: 14, carbs: 5 },
      price: 188,
      maxFlavors: 1,
    },
    {
      id: 6,
      name: "3 pcs. Chicken With Rice and Drink",
      description: "Good for 1 pax.",
      image: "https://bit.ly/4r1CAtC",
      nutrition: { calories: 280, protein: 34, fats: 14, carbs: 5 },
      price: 228,
      maxFlavors: 1,
    },
  ],
  Drinks: [
    {
      id: 7,
      name: "Kiwi Ice Blended",
      description:
        "Blended until smooth and chilled to perfection, this drink has a refreshing, slightly creamy texture with a bright, citrusy kick.",
      image: "https://i.pinimg.com/1200x/3e/04/b8/3e04b89327ef2c1b50ee0e5b94068aaa.jpg",
      nutrition: { calories: 180, protein: 3, fats: 2, carbs: 44 },
      price: 4.49,
    },
  ],
  Burger: [
    {
      id: 8,
      name: "Chicken Burger with Cheese",
      description:
        "A crispy, juicy chicken burger with a special crunch coating, served on a toasted bun with fresh lettuce and a tangy sauce. Perfect for a quick, satisfying meal.",
      image: "https://i.pinimg.com/736x/d4/38/09/d4380931a50783483fc53d55209245e1.jpg",
      nutrition: { calories: 520, protein: 22, fats: 18, carbs: 68 },
      price: 9.99,
    },
  ],
  Chips: [
    {
      id: 9,
      name: "Crispy Potato Chips",
      description:
        "Each piece is evenly seasoned to bring out a rich, savory flavor that keeps you coming back for more.",
      image: "https://i.pinimg.com/736x/a4/a5/cd/a4a5cd6b777e7bb789ee02288b6eb4d2.jpg",
      nutrition: { calories: 480, protein: 28, fats: 16, carbs: 58 },
      price: 3.49,
    },
  ],
  Alacarte: [
    {
      id: 3,
      name: "Crispy Chicken Shots with Drink",
      description: "Solo Meal",
      image: "https://static.wixstatic.com/media/d2b544_0a6506e217624c37a1c251bb0e9db0c5~mv2.png/v1/crop/x_0,y_65,w_1042,h_913/fill/w_835,h_732,al_c,q_90,usm_0.66_1.00_0.01,enc_auto/Copy%20of%20Untitled_20250305_163643_0000-20.png",
      nutrition: { calories: 235, protein: 11, fats: 30, carbs: 60 },
      price: 88,
      maxFlavors: 1,
    },
    {
      id: 4,
      name: "Chicken Skin with Rice and Drink",
      description: "Solo Meal",
      image: "https://bit.ly/3P6DcAK",
      nutrition: { calories: 280, protein: 34, fats: 14, carbs: 5 },
      price: 78,
      maxFlavors: 1,
    },
    {
      id: 5,
      name: "2 pcs. Chicken With Rice and Drink",
      description: "Solo Meal",
      image: "https://bit.ly/4r5rfZI",
      nutrition: { calories: 280, protein: 34, fats: 14, carbs: 5 },
      price: 148,
      maxFlavors: 1,
    },
    {
      id: 6,
      name: "3 pcs. Chicken With Rice and Drink",
      description: "Solo Meal",
      image: "https://bit.ly/4r1CAtC",
      nutrition: { calories: 280, protein: 34, fats: 14, carbs: 5 },
      price: 188,
      maxFlavors: 1,
    },
  ],
};

const moreRecipes: MoreRecipe[] = [
  { name: "Twister Fries", time: "5 min", img: "https://i.pinimg.com/736x/e1/fe/5d/e1fe5d75042f22074b9ec16f1db491f4.jpg" },
  { name: "Regular Fries", time: "5 min", img: "https://i.pinimg.com/1200x/95/02/12/9502126d74d78185aca0697e53c91197.jpg" },
  { name: "TTEOKBOKKI", time: "15 min", img: "https://bit.ly/3MMEeRT" },
  { name: "Fish Cake", time: "5 min", img: "https://bit.ly/4s9ZvUC" },
  { name: "Kimchi", time: "5 min", img: "https://bit.ly/47bPoX5" },
];

const categories: string[] = ["All", "Chicken", "Burger", "Drinks", "Chips", "Alacarte"];
const mealTypes: string[] = ["Breakfast", "Lunch", "Dinner"];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.45, type: "tween" as const, ease: "easeInOut" as const },
  }),
  exit: { opacity: 0, y: -16, transition: { duration: 0.25 } },
};

// FlavorPicker sub-component
function FlavorPicker({ maxFlavors, selected, onChange }: { maxFlavors: number; selected: string[]; onChange: (flavors: string[]) => void }) {
  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((f) => f !== name));
    } else if (selected.length < maxFlavors) {
      onChange([...selected, name]);
    }
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Signature Flavor{maxFlavors > 1 ? `s` : ""} — pick {maxFlavors === 1 ? "1" : `up to ${maxFlavors}`}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {FLAVORS.map((flavor) => {
          const isSelected = selected.includes(flavor.name);
          const isDisabled = !isSelected && selected.length >= maxFlavors;
          return (
            <motion.button
              key={flavor.name}
              onClick={() => !isDisabled && toggle(flavor.name)}
              whileTap={!isDisabled ? { scale: 0.94 } : {}}
              whileHover={!isDisabled ? { y: -1 } : {}}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 9,
                border: isSelected ? `2px solid ${flavor.color}` : "1.5px solid #e5e7eb",
                background: isSelected ? flavor.color : "#f9fafb",
                color: isSelected ? "#fff" : isDisabled ? "#d1d5db" : "#374151",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: isDisabled ? "not-allowed" : "pointer",
                fontFamily: "'Poppins', sans-serif",
                opacity: isDisabled ? 0.45 : 1,
                transition: "all 0.18s ease",
                letterSpacing: "0.02em",
              }}
            >
              {flavor.name}
              {isSelected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{ marginLeft: 2, fontSize: 10, opacity: 0.85 }}
                >
                  ✓
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default function Delicacy() {
  const [activeCategory, setActiveCategory] = useState<string>("Chicken");
  const [activeMeal, setActiveMeal] = useState<string>("Lunch");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [addedId, setAddedId] = useState<number | null>(null);
  // flavor selections keyed by recipe id
  const [flavorSelections, setFlavorSelections] = useState<Record<number, string[]>>({});

  const displayRecipes: Recipe[] =
    activeCategory === "All"
      ? Object.values(recipes).flat()
      : recipes[activeCategory] ?? [];

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const addToCart = (recipe: Recipe) => {
    const selectedFlavors = flavorSelections[recipe.id] || [];
    setCart((prev) => {
      const existing = prev.find((i) => i.id === recipe.id);
      if (existing) {
        return prev.map((i) =>
          i.id === recipe.id ? { ...i, quantity: i.quantity + 1, selectedFlavors } : i
        );
      }
      return [...prev, { ...recipe, quantity: 1, selectedFlavors }];
    });
    setAddedId(recipe.id);
    setTimeout(() => setAddedId(null), 900);
    setCartOpen(true);
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: "#f5f6fa", minHeight: "100vh", paddingBottom: 80 }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Floating Cart Button */}
      <motion.button
        onClick={() => setCartOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        style={{
          position: "fixed",
          top: 28,
          right: 36,
          zIndex: 100,
          background: "#111827",
          color: "#fff",
          border: "none",
          borderRadius: 50,
          padding: "12px 22px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "'Poppins', sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        }}
      >
        <span>Cart</span>
        <AnimatePresence>
          {totalItems > 0 && (
            <motion.span
              key={totalItems}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              style={{
                background: "#ef4444",
                color: "#fff",
                borderRadius: "50%",
                width: 22,
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {totalItems}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Cart Drawer */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200 }}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: 400,
                background: "#fff",
                zIndex: 300,
                display: "flex",
                flexDirection: "column",
                boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Your Order</h2>
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0", fontWeight: 400 }}>
                    {totalItems === 0 ? "No items yet" : `${totalItems} item${totalItems > 1 ? "s" : ""} in your order`}
                  </p>
                </div>
                <motion.button
                  whileHover={{ background: "#f3f4f6" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCartOpen(false)}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    width: 36,
                    height: 36,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    color: "#6b7280",
                  }}
                >
                  ✕
                </motion.button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 32px" }}>
                <AnimatePresence>
                  {cart.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ textAlign: "center", paddingTop: 80, color: "#d1d5db" }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Your order is empty</div>
                      <div style={{ fontSize: 12, marginTop: 6 }}>Add items from the menu!</div>
                    </motion.div>
                  ) : (
                    cart.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ duration: 0.22 }}
                        style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 0", borderBottom: "1px solid #f9fafb" }}
                      >
                        <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                          <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>₱{item.price.toFixed(2)} each</div>
                          {item.selectedFlavors && item.selectedFlavors.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                              {item.selectedFlavors.map((f) => {
                                const fl = FLAVORS.find((fl) => fl.name === f);
                                return (
                                  <span key={f} style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: fl?.color || "#888", borderRadius: 6, padding: "2px 7px" }}>
                                    {f}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => updateQty(item.id, -1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", fontWeight: 600 }}>−</motion.button>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", minWidth: 18, textAlign: "center" }}>{item.quantity}</span>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => updateQty(item.id, 1)} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "#111827", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600 }}>+</motion.button>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 60 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>₱{(item.price * item.quantity).toFixed(2)}</div>
                          <motion.button whileHover={{ color: "#ef4444" }} onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#d1d5db", fontFamily: "'Poppins', sans-serif", padding: 0, marginTop: 4, transition: "color 0.2s" }}>Remove</motion.button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              {cart.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ padding: "20px 32px 32px", borderTop: "1px solid #f3f4f6" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>Subtotal</span>
                    <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>₱{totalPrice.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Total</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>₱{totalPrice.toFixed(2)}</span>
                  </div>
                  <motion.button
                    whileHover={{ backgroundColor: "#1f2937" }}
                    whileTap={{ scale: 0.98 }}
                    style={{ width: "100%", background: "#111827", color: "#fff", border: "none", borderRadius: 14, padding: "15px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Poppins', sans-serif", letterSpacing: "0.02em", transition: "background 0.2s" }}
                  >
                    Place Order · ₱{totalPrice.toFixed(2)}
                  </motion.button>
                  <motion.button
                    whileHover={{ color: "#ef4444" }}
                    onClick={() => setCart([])}
                    style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "'Poppins', sans-serif", fontSize: 12, color: "#d1d5db", marginTop: 12, transition: "color 0.2s" }}
                  >
                    Clear order
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "52px 36px 0" }}>
        <motion.h1
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ fontSize: 46, fontWeight: 700, color: "#111827", marginBottom: 8, letterSpacing: "-0.5px" }}
        >
          Menu
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{ display: "flex", gap: 4, marginBottom: 48, borderBottom: "1px solid #e5e7eb" }}
        >
          {categories.map((cat) => (
            <motion.button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              whileTap={{ scale: 0.96 }}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: activeCategory === cat ? 600 : 400, color: activeCategory === cat ? "#111827" : "#9ca3af", padding: "12px 20px", position: "relative", transition: "color 0.2s" }}
            >
              {cat}
              {activeCategory === cat && (
                <motion.div layoutId="activeTab" style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 2, background: "#111827", borderRadius: 2 }} />
              )}
            </motion.button>
          ))}
        </motion.div>

        <div style={{ display: "flex", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 36, paddingTop: 10, minWidth: 72, alignItems: "center" }}>
            {mealTypes.map((meal) => (
              <motion.button
                key={meal}
                onClick={() => setActiveMeal(meal)}
                whileHover={{ x: 2 }}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 8, padding: 0, position: "relative" }}
              >
                <span style={{ fontSize: 12, fontWeight: activeMeal === meal ? 600 : 400, color: activeMeal === meal ? "#111827" : "#d1d5db", writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: "0.08em", transition: "color 0.2s" }}>
                  {meal}
                </span>
                {activeMeal === meal && (
                  <motion.div layoutId="mealDot" style={{ position: "absolute", right: -12, top: "50%", transform: "translateY(-50%)", width: 6, height: 6, borderRadius: "50%", background: "#111827" }} />
                )}
              </motion.button>
            ))}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
            <AnimatePresence mode="wait">
              {displayRecipes.map((recipe, i) => (
                <motion.div
                  key={recipe.id}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  style={{ background: "#ffffff", borderRadius: 28, padding: "36px 40px", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 4px 24px rgba(0,0,0,0.05)", display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 40 }}
                >
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8, lineHeight: 1.3 }}>{recipe.name}</h2>
                    <p style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.75, marginBottom: 22 }}>{recipe.description.slice(0, 200)}</p>

                    <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>Nutritional Values</p>
                    <div style={{ display: "flex", gap: 28, marginBottom: 26 }}>
                      {([
                        { label: "Calories", unit: "Kcal", value: recipe.nutrition.calories },
                        { label: "Protein", unit: "g", value: recipe.nutrition.protein },
                        { label: "Fats", unit: "g", value: recipe.nutrition.fats },
                        { label: "Carbs", unit: "g", value: recipe.nutrition.carbs },
                      ] as { label: string; unit: string; value: number }[]).map((n) => (
                        <motion.div key={n.label} whileHover={{ y: -2 }} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{n.value}</div>
                          <div style={{ fontSize: 10.5, fontWeight: 500, color: "#6b7280" }}>{n.label}</div>
                          <div style={{ fontSize: 9.5, color: "#d1d5db" }}>{n.unit}</div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Flavor Picker — only for items that have maxFlavors */}
                    {recipe.maxFlavors && (
                      <FlavorPicker
                        maxFlavors={recipe.maxFlavors}
                        selected={flavorSelections[recipe.id] || []}
                        onChange={(flavors) =>
                          setFlavorSelections((prev) => ({ ...prev, [recipe.id]: flavors }))
                        }
                      />
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <motion.button
                          onClick={() => addToCart(recipe)}
                          animate={addedId === recipe.id ? { scale: [1, 0.93, 1.05, 1] } : {}}
                          transition={{ duration: 0.35 }}
                          whileHover={{ backgroundColor: addedId === recipe.id ? "#16a34a" : "#1f2937" }}
                          whileTap={{ scale: 0.97 }}
                          style={{ background: addedId === recipe.id ? "#16a34a" : "#111827", color: "#fff", border: "none", borderRadius: 11, padding: "11px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif", transition: "background 0.25s" }}
                        >
                          {addedId === recipe.id ? "✓ Added!" : "Order"}
                        </motion.button>
                        <motion.button
                          onClick={() => toggleFavorite(recipe.id)}
                          whileHover={{ backgroundColor: favorites.includes(recipe.id) ? "#fef3c7" : "#f3f4f6" }}
                          whileTap={{ scale: 0.97 }}
                          style={{ background: favorites.includes(recipe.id) ? "#fffbeb" : "#f9fafb", color: favorites.includes(recipe.id) ? "#b45309" : "#6b7280", border: `1px solid ${favorites.includes(recipe.id) ? "#fde68a" : "#e5e7eb"}`, borderRadius: 11, padding: "11px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Poppins', sans-serif", transition: "all 0.2s" }}
                        >
                          {favorites.includes(recipe.id) ? "Saved ★" : "Add to favorites"}
                        </motion.button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>Price</span>
                        <span style={{ fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: "-0.5px" }}>₱{recipe.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.04 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    style={{ width: 230, height: 230, borderRadius: "50%", overflow: "hidden", flexShrink: 0, boxShadow: "0 12px 44px rgba(0,0,0,0.12)", marginTop: 8 }}
                  >
                    <img src={recipe.image.trim()} alt={recipe.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>

            {displayRecipes.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: 80, color: "#d1d5db", fontSize: 14, fontWeight: 500 }}>
                No recipes found in this category.
              </motion.div>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          style={{ marginTop: 64 }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 28, letterSpacing: "-0.3px" }}>Side Dishes</h2>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {moreRecipes.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.06 }}
                whileHover={{ y: -5, boxShadow: "0 8px 28px rgba(0,0,0,0.09)" }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", background: "#fff", borderRadius: 20, padding: "22px 26px", minWidth: 130, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "box-shadow 0.25s" }}
              >
                <motion.div whileHover={{ scale: 1.06 }} transition={{ duration: 0.25 }} style={{ width: 76, height: 76, borderRadius: "50%", overflow: "hidden", marginBottom: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}>
                  <img src={r.img} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </motion.div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 4, textAlign: "center" }}>{r.name}</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{r.time} cooking time</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}