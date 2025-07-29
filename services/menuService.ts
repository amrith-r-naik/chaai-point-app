import { db } from "@/lib/db";

export interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price: number;
  image?: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuItemData {
  name: string;
  category: string;
  price: number;
  image?: string;
}

export interface UpdateMenuItemData {
  name?: string;
  category?: string;
  price?: number;
  description?: string;
  image?: string;
  isActive?: number;
}

class MenuService {
  // Get all menu items
  async getAllMenuItems(): Promise<MenuItem[]> {
    if (!db) throw new Error("Database not initialized");

    try {
      const items = (await db.getAllAsync(`
        SELECT * FROM menu_items 
        ORDER BY category, name
      `)) as MenuItem[];

      return items || [];
    } catch (error) {
      console.error("Error fetching menu items:", error);
      throw error;
    }
  }

  // Get active menu items only
  async getActiveMenuItems(): Promise<MenuItem[]> {
    if (!db) throw new Error("Database not initialized");

    try {
      const items = (await db.getAllAsync(`
        SELECT * FROM menu_items 
        WHERE isActive = 1
        ORDER BY category, name
      `)) as MenuItem[];

      return items || [];
    } catch (error) {
      console.error("Error fetching active menu items:", error);
      throw error;
    }
  }

  // Clear all menu items
  async clearAllMenuItems(): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    try {
      await db.runAsync(`DELETE FROM menu_items`);
      console.log("All menu items cleared");
    } catch (error) {
      console.error("Error clearing menu items:", error);
      throw error;
    }
  }

  // Add demo menu items
  async addDemoMenuItems(): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    const demoItems = [
      // Tea Category
      {
        name: "Masala Chai",
        category: "Tea",
        price: 35,
      },
      {
        name: "Lemon Tea",
        category: "Tea",
        price: 30,
      },
      {
        name: "Black Tea",
        category: "Tea",
        price: 25,
      },
      {
        name: "Green Tea",
        category: "Tea",
        price: 40,
      },
      {
        name: "Iced Tea",
        category: "Tea",
        price: 45,
      },

      // Coffee Category
      {
        name: "Cappuccino",
        category: "Coffee",
        price: 80,
      },
      {
        name: "Latte",
        category: "Coffee",
        price: 85,
      },
      {
        name: "Americano",
        category: "Coffee",
        price: 70,
      },
      {
        name: "Cold Coffee",
        category: "Coffee",
        price: 90,
      },

      // Pasta Category
      {
        name: "White Sauce Pasta",
        category: "Pasta",
        price: 110,
      },
      {
        name: "Red Sauce Pasta",
        category: "Pasta",
        price: 120,
      },
      {
        name: "Pesto Pasta",
        category: "Pasta",
        price: 130,
      },
      {
        name: "Aglio Olio",
        category: "Pasta",
        price: 100,
      },

      // Snacks Category
      {
        name: "Peri Peri Fries",
        category: "Snacks",
        price: 100,
      },
      {
        name: "Cheese Fries",
        category: "Snacks",
        price: 120,
      },
      {
        name: "Chicken Wings",
        category: "Snacks",
        price: 150,
      },
      {
        name: "Garlic Bread",
        category: "Snacks",
        price: 80,
      },
      {
        name: "Nachos",
        category: "Snacks",
        price: 110,
      },

      // Beverages Category
      {
        name: "Fresh Lime Soda",
        category: "Beverages",
        price: 50,
      },
      {
        name: "Mango Shake",
        category: "Beverages",
        price: 80,
      },
      {
        name: "Chocolate Shake",
        category: "Beverages",
        price: 90,
      },
      {
        name: "Fresh Orange Juice",
        category: "Beverages",
        price: 60,
      },
    ];

    try {
      for (const item of demoItems) {
        const id = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        await db.runAsync(
          `
          INSERT INTO menu_items (
            id, name, category, price, isActive, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, 1, ?, ?)
        `,
          [id, item.name, item.category, item.price, now, now]
        );
      }
      console.log("Demo menu items added successfully");
    } catch (error) {
      console.error("Error adding demo menu items:", error);
      throw error;
    }
  }

  // Get hardcoded menu items (fallback for compatibility)
  async getHardcodedMenuItems(): Promise<MenuItem[]> {
    // First try to get from database
    try {
      const dbItems = await this.getActiveMenuItems();
      if (dbItems.length > 0) {
        return dbItems;
      }
    } catch {
      console.warn("Could not fetch from database, using hardcoded items");
    }

    // Fallback to hardcoded items
    return [
      {
        id: "item_1",
        name: "Lemon Tea",
        category: "Tea",
        price: 30,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "item_2",
        name: "White Sauce Pasta",
        category: "Pasta",
        price: 110,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "item_3",
        name: "Peri Peri Fries",
        category: "Snacks",
        price: 100,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "item_4",
        name: "Black Tea",
        category: "Tea",
        price: 25,
        isActive: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

export const menuService = new MenuService();
