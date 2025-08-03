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

  // Add a new menu item
  async createMenuItem(data: CreateMenuItemData): Promise<string> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Check if item with same name already exists
      const existingItem = await db.getFirstAsync(`
        SELECT id FROM menu_items WHERE name = ? COLLATE NOCASE
      `, [data.name]) as { id: string } | null;

      if (existingItem) {
        throw new Error("A menu item with this name already exists");
      }

      const id = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      await db.runAsync(`
        INSERT INTO menu_items (id, name, category, price, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `, [id, data.name, data.category, data.price, now, now]);

      console.log("Menu item created successfully:", data.name);
      return id;
    } catch (error) {
      console.error("Error creating menu item:", error);
      throw error;
    }
  }

  // Update an existing menu item
  async updateMenuItem(itemId: string, data: UpdateMenuItemData): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Check if another item with same name exists (excluding current item)
      if (data.name) {
        const existingItem = await db.getFirstAsync(`
          SELECT id FROM menu_items 
          WHERE name = ? COLLATE NOCASE AND id != ?
        `, [data.name, itemId]) as { id: string } | null;

        if (existingItem) {
          throw new Error("A menu item with this name already exists");
        }
      }

      const updateFields = [];
      const updateValues = [];

      if (data.name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(data.name);
      }
      if (data.category !== undefined) {
        updateFields.push('category = ?');
        updateValues.push(data.category);
      }
      if (data.price !== undefined) {
        updateFields.push('price = ?');
        updateValues.push(data.price);
      }
      if (data.isActive !== undefined) {
        updateFields.push('isActive = ?');
        updateValues.push(data.isActive);
      }

      updateFields.push('updatedAt = ?');
      updateValues.push(new Date().toISOString());
      updateValues.push(itemId);

      const result = await db.runAsync(`
        UPDATE menu_items 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, updateValues);

      if (result.changes === 0) {
        throw new Error("Menu item not found");
      }

      console.log("Menu item updated successfully");
    } catch (error) {
      console.error("Error updating menu item:", error);
      throw error;
    }
  }

  // Delete a menu item
  async deleteMenuItem(itemId: string): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    try {
      // Check if the item is used in any orders
      const kotItemsCount = await db.getFirstAsync(`
        SELECT COUNT(*) as count FROM kot_items WHERE itemId = ?
      `, [itemId]) as { count: number };

      if (kotItemsCount.count > 0) {
        throw new Error(
          `Cannot delete this menu item because it is referenced in ${kotItemsCount.count} order items. ` +
          `This helps preserve order history.`
        );
      }

      const result = await db.runAsync(`
        DELETE FROM menu_items WHERE id = ?
      `, [itemId]);

      if (result.changes === 0) {
        throw new Error("Menu item not found");
      }

      console.log("Menu item deleted successfully");
    } catch (error) {
      console.error("Error deleting menu item:", error);
      throw error;
    }
  }

  // Add demo menu items
  async addDemoMenuItems(): Promise<void> {
    if (!db) throw new Error("Database not initialized");

    const demoItems = [
      {
        name: "Normal Tea - Single",
        category: "Tea",
        price: 20,
      },
      {
        name: "Normal Tea - Double",
        category: "Tea",
        price: 40,
      },
      {
        name: "Ginger Tea - Single",
        category: "Tea",
        price: 20,
      },
      {
        name: "Ginger Tea - Double",
        category: "Tea",
        price: 40,
      },
      {
        name: "Elaichi Tea - Single",
        category: "Tea",
        price: 25,
      },
      {
        name: "Elaichi Tea - Double",
        category: "Tea",
        price: 50,
      },
      {
        name: "Masala Tea - Single",
        category: "Tea",
        price: 25,
      },
      {
        name: "Masala Tea - Double",
        category: "Tea",
        price: 50,
      },
      {
        name: "Black Tea - Single",
        category: "Tea",
        price: 15,
      },
      {
        name: "Black Tea - Double",
        category: "Tea",
        price: 30,
      },
      {
        name: "Green Tea - Single",
        category: "Tea",
        price: 20,
      },
      {
        name: "Green Tea - Double",
        category: "Tea",
        price: 40,
      },
      {
        name: "Lemon Tea - Single",
        category: "Tea",
        price: 15,
      },
      {
        name: "Lemon Tea - Double",
        category: "Tea",
        price: 30,
      },
      {
        name: "Honey Lemon Tea - Single",
        category: "Tea",
        price: 25,
      },
      {
        name: "Honey Lemon Tea - Double",
        category: "Tea",
        price: 50,
      },
      {
        name: "Mint Honey Lemon Tea - Single",
        category: "Tea",
        price: 25,
      },
      {
        name: "Mint Honey Lemon Tea - Double",
        category: "Tea",
        price: 50,
      },
      {
        name: "Ginger Honey Lemon Tea - Single",
        category: "Tea",
        price: 30,
      },
      {
        name: "Ginger Honey Lemon Tea - Double",
        category: "Tea",
        price: 60,
      },
      {
        name: "Mint Lemon Tea - Single",
        category: "Tea",
        price: 20,
      },
      {
        name: "Mint Lemon Tea - Double",
        category: "Tea",
        price: 40,
      },
      {
        name: "Ginger Lemon Tea - Single",
        category: "Tea",
        price: 20,
      },
      {
        name: "Ginger Lemon Tea - Double",
        category: "Tea",
        price: 40,
      },
      {
        name: "Mint Ginger Honey Lemon Tea - Single",
        category: "Tea",
        price: 30,
      },
      {
        name: "Mint Ginger Honey Lemon Tea - Double",
        category: "Tea",
        price: 60,
      },
      {
        name: "Black Coffee - Single",
        category: "Hot Cups",
        price: 15,
      },
      {
        name: "Black Coffee - Double",
        category: "Hot Cups",
        price: 30,
      },
      {
        name: "Coffee - Single",
        category: "Hot Cups",
        price: 20,
      },
      {
        name: "Coffee - Double",
        category: "Hot Cups",
        price: 40,
      },
      {
        name: "Badam Milk - Single",
        category: "Hot Cups",
        price: 20,
      },
      {
        name: "Badam Milk - Double",
        category: "Hot Cups",
        price: 40,
      },
      {
        name: "Kashaya - Single",
        category: "Hot Cups",
        price: 20,
      },
      {
        name: "Kashaya - Double",
        category: "Hot Cups",
        price: 40,
      },
      {
        name: "Horlicks - Single",
        category: "Hot Cups",
        price: 20,
      },
      {
        name: "Horlicks - Double",
        category: "Hot Cups",
        price: 40,
      },
      {
        name: "Boost - Single",
        category: "Hot Cups",
        price: 20,
      },
      {
        name: "Boost - Double",
        category: "Hot Cups",
        price: 40,
      },
      {
        name: "Bournvita - Single",
        category: "Hot Cups",
        price: 20,
      },
      {
        name: "Bournvita - Double",
        category: "Hot Cups",
        price: 40,
      },
      {
        name: "Virgin Mojito",
        category: "Mojito",
        price: 80,
      },
      {
        name: "Blue Mojito",
        category: "Mojito",
        price: 80,
      },
      {
        name: "Lime Juice",
        category: "Refreshers",
        price: 40,
      },
      {
        name: "Lime Soda",
        category: "Refreshers",
        price: 50,
      },
      {
        name: "Mint Lime Juice",
        category: "Refreshers",
        price: 50,
      },
      {
        name: "Ice Lemon Juice",
        category: "Refreshers",
        price: 60,
      },
      {
        name: "Watermelon Juice",
        category: "Refreshers",
        price: 60,
      },
      {
        name: "Pineapple Juice",
        category: "Refreshers",
        price: 60,
      },
      {
        name: "Lemon Ice Tea",
        category: "Refreshers",
        price: 70,
      },
      {
        name: "Black Cold Coffee",
        category: "Refreshers",
        price: 110,
      },
      {
        name: "Badam Shake",
        category: "Milkshakes",
        price: 60,
      },
      {
        name: "Horlicks Shake",
        category: "Milkshakes",
        price: 60,
      },
      {
        name: "Bournvita Shake",
        category: "Milkshakes",
        price: 60,
      },
      {
        name: "Cold Coffee",
        category: "Milkshakes",
        price: 60,
      },
      {
        name: "Kitkat Shake",
        category: "Milkshakes",
        price: 80,
      },
      {
        name: "Oreo Shake",
        category: "Milkshakes",
        price: 80,
      },
      {
        name: "Snickers Shake",
        category: "Milkshakes",
        price: 80,
      },
      {
        name: "Belgium Chocolate",
        category: "Milkshakes",
        price: 90
      },
      {
        name: "Lotus Biscoff Shake",
        category: "Milkshakes",
        price: 120,
      },
      {
        name: "Plain Maggie",
        category: "Maggie",
        price: 40,
      },
      {
        name: "Mix Veg Maggie",
        category: "Maggie",
        price: 50,
      },
      {
        name: "Masala Maggie",
        category: "Maggie",
        price: 50,
      },
      {
        name: "Cheese Maggie",
        category: "Maggie",
        price: 60,
      },
      {
        name: "Masala Mix Veg Maggie",
        category: "Maggie",
        price: 60,
      },
      {
        name: "Masala Cheese Maggie",
        category: "Maggie",
        price: 70,
      },
      {
        name: "Egg Maggie",
        category: "Maggie",
        price: 60,
      },
      {
        name: "Masala Egg Maggie",
        category: "Maggie",
        price: 70,
      },
      {
        name: "Plain Gheeroast Maggie",
        category: "Maggie",
        price: 80,
      },
      {
        name: "Paneer Gheeroast Maggie",
        category: "Maggie",
        price: 90,
      },
      {
        name: "Egg Gheeroast Maggie",
        category: "Maggie",
        price: 90,
      },
      {
        name: "Chicken Gheeroast Maggie",
        category: "Maggie",
        price: 100,
      },
      {
        name: "French Fries",
        category: "Quick Bites",
        price: 80,
      },
      {
        name: "Peri Peri Fries",
        category: "Quick Bites",
        price: 90,
      },
      {
        name: "Cheese Fries",
        category: "Quick Bites",
        price: 110,
      },
      {
        name: "Jalapeno Cheese Fries",
        category: "Quick Bites",
        price: 120,
      },
      {
        name: "Jalapeno Peri Peri Fries",
        category: "Quick Bites",
        price: 130,
      },
      {
        name: "Veg Fingers",
        category: "Quick Bites",
        price: 90,
      },
      {
        name: "Chicken Nuggets",
        category: "Quick Bites",
        price: 110,
      },
      {
        name: "Veg Cheese Poppers",
        category: "Quick Bites",
        price: 90,
      },
      {
        name: "Chicken Cheese Poppers",
        category: "Quick Bites",
        price: 110,
      },
      {
        name: "Vada Pav",
        category: "Quick Bites",
        price: 20,
      },
      {
        name: "Bread Pakoda",
        category: "Quick Bites",
        price: 40,
      },
      {
        name: "Pav Bhaji",
        category: "Quick Bites",
        price: 60,
      },
      {
        name: "Extra Pav",
        category: "Quick Bites",
        price: 10,
      },
      {
        name: "Bread Jam",
        category: "Sandwich",
        price: 40,
      },
      {
        name: "Bread Maska Jam",
        category: "Sandwich",
        price: 50,
      },
      {
        name: "Cheese Toast",
        category: "Sandwich",
        price: 60,
      },
      {
        name: "Chutney Cheese Toast",
        category: "Sandwich",
        price: 60,
      },
      {
        name: "Veg Sandwich",
        category: "Sandwich",
        price: 50,
      },
      {
        name: "Veg Cheese Sandwich",
        category: "Sandwich",
        price: 60,
      },
      {
        name: "Grill Corn Cheese Sandwich",
        category: "Sandwich",
        price: 60,
      },
      {
        name: "Paneer Tikka Sandwich",
        category: "Sandwich",
        price: 80,
      },
      {
        name: "Mushroom Tikka Sandwich",
        category: "Sandwich",
        price: 90,
      },
      {
        name: "Egg Cheese Sandwich",
        category: "Sandwich",
        price: 60,
      },
      {
        name: "Chicken Sandwich",
        category: "Sandwich",
        price: 70,
      },
      {
        name: "Chicken Tikka Sandwich",
        category: "Sandwich",
        price: 100,
      },
      {
        name: "Chicken BBQ Sandwich",
        category: "Sandwich",
        price: 100,
      },
      {
        name: "Chicken Club Sandwich",
        category: "Sandwich",
        price: 120,
      },
      {
        name: "Veg Patty Burger",
        category: "Burger",
        price: 80,
      },
      {
        name: "Paneer Tikka Burger",
        category: "Burger",
        price: 100,
      },
      {
        name: "Chicken Patty Burger",
        category: "Burger",
        price: 90,
      },
      {
        name: "Peri Peri Chicken Burger",
        category: "Burger",
        price: 100,
      },
      {
        name: "BBQ Chicken Burger",
        category: "Burger",
        price: 100,
      },
      {
        name: "Crispy Chicken Burger",
        category: "Burger",
        price: 120,
      },
      {
        name: "Chicken Tikka Burger",
        category: "Burger",
        price: 120,
      },
      {
        name: "Plain Omlette",
        category: "Omlette",
        price: 40,
      },
      {
        name: "Masala Omlette",
        category: "Omlette",
        price: 50,
      },
      {
        name: "Bread Omlette",
        category: "Omlette",
        price: 60,
      },
      {
        name: "Cheese Bread Omlette",
        category: "Omlette",
        price: 70,
      },
      {
        name: "Masala Bread Omlette",
        category: "Omlette",
        price: 70,
      },
      {
        name: "Veg Roll",
        category: "Rolls",
        price: 40,
      },
      {
        name: "Paneer Masala Roll",
        category: "Rolls",
        price: 60,
      },
      {
        name: "Egg Roll",
        category: "Rolls",
        price: 50,
      },
      {
        name: "Chicken Egg Roll",
        category: "Rolls",
        price: 80,
      },
      {
        name: "Veg Momos - Fried",
        category: "Momos",
        price: 80,
      },
      {
        name: "Veg Momos - Butter Garlic",
        category: "Momos",
        price: 90,
      },
      {
        name: "Veg Momos - Peri Peri",
        category: "Momos",
        price: 100,
      },
      {
        name: "Paneer Momos - Fried",
        category: "Momos",
        price: 90,
      },
      {
        name: "Paneer Momos - Butter Garlic",
        category: "Momos",
        price: 90,      
      },
      {
        name: "Paneer Momos - Peri Peri",
        category: "Momos",
        price: 100,
      },
      {
        name: "Chicken Momos - Fried",
        category: "Momos",
        price: 100,
      },
      {
        name: "Chicken Momos - Butter Garlic",
        category: "Momos",
        price: 110,
      },
      {
        name: "Chicken Momos - Peri Peri",
        category: "Momos",
        price: 110,
      },
      {
        name: "Marlboro Advance",
        category: "Cigarettes",
        price: 20,
      },
      {
        name: "Marlboro Double Switch",
        category: "Cigarettes",
        price: 20,
      },
      {
        name: "Mixpod",
        category: "Cigarettes",
        price: 20,
      },
      {
        name: "Classic Ice Burst",
        category: "Cigarettes",
        price: 20,
      },
      {
        name: "Classic Mild",
        category: "Cigarettes",
        price: 20,
      },
      {
        name: "Classic Ultra Mild",
        category: "Cigarettes",
        price: 20,
      },
      {
        name: "Classic Connect",
        category: "Cigarettes",
        price: 15,
      },
      {
        name: "King",
        category: "Cigarettes",
        price: 20,
      },
      {
        name: "Lights",
        category: "Cigarettes",
        price: 20,
      },
      {
        name: "Small",
        category: "Cigarettes",
        price: 10,
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
