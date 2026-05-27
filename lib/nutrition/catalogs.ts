/**
 * Catálogos para los selectores del onboarding / perfil. Puros (cliente y servidor).
 */

export interface Country {
  name: string; // se guarda este nombre en nutrition_profiles.country
  flag: string; // emoji bandera
}

/** Países (foco Latinoamérica + España + comunes). Nombre = valor guardado. */
export const COUNTRIES: Country[] = [
  { name: "Perú", flag: "🇵🇪" },
  { name: "México", flag: "🇲🇽" },
  { name: "Colombia", flag: "🇨🇴" },
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Chile", flag: "🇨🇱" },
  { name: "Ecuador", flag: "🇪🇨" },
  { name: "Bolivia", flag: "🇧🇴" },
  { name: "Venezuela", flag: "🇻🇪" },
  { name: "Uruguay", flag: "🇺🇾" },
  { name: "Paraguay", flag: "🇵🇾" },
  { name: "Brasil", flag: "🇧🇷" },
  { name: "España", flag: "🇪🇸" },
  { name: "Costa Rica", flag: "🇨🇷" },
  { name: "Panamá", flag: "🇵🇦" },
  { name: "Guatemala", flag: "🇬🇹" },
  { name: "Honduras", flag: "🇭🇳" },
  { name: "El Salvador", flag: "🇸🇻" },
  { name: "Nicaragua", flag: "🇳🇮" },
  { name: "República Dominicana", flag: "🇩🇴" },
  { name: "Cuba", flag: "🇨🇺" },
  { name: "Puerto Rico", flag: "🇵🇷" },
  { name: "Estados Unidos", flag: "🇺🇸" },
  { name: "Canadá", flag: "🇨🇦" },
  { name: "Otro", flag: "🌍" },
];

export interface FoodOption {
  name: string; // se guarda este nombre (CSV) en el perfil
  emoji: string; // ejemplifica el alimento (mismo animal/cosa pese al nombre regional)
}

/** Favoritas: alimentos comunes que pueden formar parte de un plan balanceado. */
export const FAVORITE_FOOD_OPTIONS: FoodOption[] = [
  { name: "Pollo", emoji: "🍗" },
  { name: "Pescado", emoji: "🐟" },
  { name: "Huevos", emoji: "🥚" },
  { name: "Yogur natural", emoji: "🥛" },
  { name: "Avena", emoji: "🥣" },
  { name: "Arroz integral", emoji: "🍚" },
  { name: "Quinua", emoji: "🌾" },
  { name: "Camote", emoji: "🍠" },
  { name: "Lentejas", emoji: "🫘" },
  { name: "Garbanzos", emoji: "🫛" },
  { name: "Palta", emoji: "🥑" },
  { name: "Manzana", emoji: "🍎" },
  { name: "Plátano", emoji: "🍌" },
  { name: "Fresas", emoji: "🍓" },
  { name: "Brócoli", emoji: "🥦" },
  { name: "Espinaca", emoji: "🥬" },
  { name: "Tomate", emoji: "🍅" },
  { name: "Nueces", emoji: "🌰" },
];

/** Frecuentes: básicos realistas para armar comidas del día a día. */
export const FREQUENT_FOOD_OPTIONS: FoodOption[] = [
  { name: "Arroz", emoji: "🍚" },
  { name: "Pan integral", emoji: "🍞" },
  { name: "Papa", emoji: "🥔" },
  { name: "Pasta integral", emoji: "🍝" },
  { name: "Avena", emoji: "🥣" },
  { name: "Huevos", emoji: "🥚" },
  { name: "Pollo", emoji: "🍗" },
  { name: "Atún", emoji: "🐟" },
  { name: "Queso fresco", emoji: "🧀" },
  { name: "Leche", emoji: "🥛" },
  { name: "Frijoles", emoji: "🫘" },
  { name: "Lentejas", emoji: "🫘" },
  { name: "Tomate", emoji: "🍅" },
  { name: "Lechuga", emoji: "🥬" },
  { name: "Zanahoria", emoji: "🥕" },
  { name: "Cebolla", emoji: "🧅" },
  { name: "Plátano", emoji: "🍌" },
  { name: "Naranja", emoji: "🍊" },
];

/** No me gusta: alimentos realmente polarizantes o de rechazo frecuente. */
export const DISLIKED_FOOD_OPTIONS: FoodOption[] = [
  { name: "Hígado", emoji: "🥩" },
  { name: "Anchoas", emoji: "🐟" },
  { name: "Sardinas", emoji: "🐟" },
  { name: "Ostras", emoji: "🦪" },
  { name: "Mariscos", emoji: "🦐" },
  { name: "Aceitunas", emoji: "🫒" },
  { name: "Cilantro", emoji: "🌿" },
  { name: "Champiñones", emoji: "🍄" },
  { name: "Berenjena", emoji: "🍆" },
  { name: "Coliflor", emoji: "🥦" },
  { name: "Brócoli", emoji: "🥦" },
  { name: "Espinaca cocida", emoji: "🥬" },
  { name: "Cebolla cruda", emoji: "🧅" },
  { name: "Picante", emoji: "🌶️" },
  { name: "Queso azul", emoji: "🧀" },
  { name: "Leche sola", emoji: "🥛" },
];

/** Evitar: opciones que suelen limitarse por azúcares, sodio, frituras o ultraprocesado. */
export const AVOID_FOOD_OPTIONS: FoodOption[] = [
  { name: "Gaseosas", emoji: "🥤" },
  { name: "Bebidas energéticas", emoji: "🥤" },
  { name: "Jugos azucarados", emoji: "🧃" },
  { name: "Dulces y caramelos", emoji: "🍬" },
  { name: "Galletas rellenas", emoji: "🍪" },
  { name: "Pasteles y tortas", emoji: "🍰" },
  { name: "Papas fritas", emoji: "🍟" },
  { name: "Frituras frecuentes", emoji: "🍤" },
  { name: "Embutidos", emoji: "🌭" },
  { name: "Tocino", emoji: "🥓" },
  { name: "Comida rápida", emoji: "🍔" },
  { name: "Pizza muy frecuente", emoji: "🍕" },
  { name: "Snacks salados", emoji: "🥨" },
  { name: "Salsas muy azucaradas", emoji: "🍯" },
  { name: "Alcohol", emoji: "🍺" },
  { name: "Cereales azucarados", emoji: "🥣" },
];

/** Catálogo general para pantallas de edición donde no hay un contexto específico. */
export const FOOD_OPTIONS: FoodOption[] = [
  ...FAVORITE_FOOD_OPTIONS,
  ...FREQUENT_FOOD_OPTIONS,
  ...DISLIKED_FOOD_OPTIONS,
  ...AVOID_FOOD_OPTIONS,
].filter((food, index, all) => all.findIndex((item) => item.name === food.name) === index);
