import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { db } from '../lib/db';
import { debugService } from './debugService';

export interface ExportData {
  customers: any[];
  expenses: any[];
  sales: any[];
  orders: any[];
}

class ExcelExportService {
  
  // Generate CSV content from array of objects
  private generateCSV(data: any[], headers: string[]): string {
    console.log('Generating CSV with data:', data.length, 'rows, headers:', headers);
    
    if (data.length === 0) {
      console.log('No data found, returning headers only');
      return headers.join(',') + '\n';
    }

    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes in CSV
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    console.log('Generated CSV with', csvRows.length - 1, 'data rows');
    return csvRows.join('\n');
  }

  // Export customers data
  async exportCustomers(dateFilter?: { startDate: string; endDate: string }): Promise<string> {
    if (!db) throw new Error("Database not initialized");

    try {
      console.log('Exporting customers with filter:', dateFilter);
      
      // First check if we have any data
      const dataCheck = await debugService.checkDataExists();
      console.log('Data check results:', dataCheck);

      // Try simple customer query first
      console.log('Trying simple customer query');
      const simpleQuery = `SELECT * FROM customers ORDER BY name ASC`;
      const simpleCustomers = await db.getAllAsync(simpleQuery);
      console.log('Simple customer query returned:', simpleCustomers.length, 'rows');
      
      if (simpleCustomers.length > 0) {
        const headers = ['id', 'name', 'contact', 'createdAt', 'creditBalance'];
        const csvContent = this.generateCSV(simpleCustomers as any[], headers);
        
        const fileName = `customers_export_${new Date().toISOString().split('T')[0]}.csv`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        return fileUri;
      }

      // If no customers found, return empty file
      const headers = ['id', 'name', 'contact', 'createdAt', 'creditBalance'];
      const csvContent = this.generateCSV([], headers);
      
      const fileName = `customers_export_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return fileUri;
    } catch (error) {
      console.error('Error exporting customers:', error);
      throw new Error('Failed to export customers data');
    }
  }

  // Export expenses data
  async exportExpenses(dateFilter?: { startDate: string; endDate: string }): Promise<string> {
    if (!db) throw new Error("Database not initialized");

    try {
      console.log('Exporting expenses with filter:', dateFilter);
      
      let query = `
        SELECT 
          id,
          voucherNo,
          towards,
          amount,
          mode,
          remarks,
          createdAt
        FROM expenses
      `;

      const params: any[] = [];
      
      if (dateFilter) {
        query += ` WHERE DATE(createdAt) BETWEEN DATE(?) AND DATE(?)`;
        params.push(dateFilter.startDate, dateFilter.endDate);
      }

      query += ` ORDER BY createdAt DESC`;

      console.log('Executing expenses query:', query, 'with params:', params);
      const expenses = await db.getAllAsync(query, params);
      console.log('Expenses query returned:', expenses.length, 'rows');

      const headers = [
        'id', 'voucherNo', 'towards', 'amount', 'mode', 'remarks', 'createdAt'
      ];

      const csvContent = this.generateCSV(expenses as any[], headers);
      
      const fileName = `expenses_export_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return fileUri;
    } catch (error) {
      console.error('Error exporting expenses:', error);
      throw new Error('Failed to export expenses data');
    }
  }

  // Export sales data
  async exportSales(dateFilter?: { startDate: string; endDate: string }): Promise<string> {
    if (!db) throw new Error("Database not initialized");

    try {
      console.log('Exporting sales with filter:', dateFilter);
      
      // First try with menuItemId column
      let query = `
        SELECT 
          ko.id,
          ko.kotNumber,
          c.name as customerName,
          ko.createdAt,
          COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalAmount,
          GROUP_CONCAT(
            mi.name || ' x' || ki.quantity || ' @' || ki.priceAtTime,
            ', '
          ) as items
        FROM kot_orders ko
        LEFT JOIN customers c ON ko.customerId = c.id
        LEFT JOIN kot_items ki ON ko.id = ki.kotId
        LEFT JOIN menu_items mi ON ki.menuItemId = mi.id
      `;

      const params: any[] = [];
      
      if (dateFilter) {
        query += ` WHERE DATE(ko.createdAt) BETWEEN DATE(?) AND DATE(?)`;
        params.push(dateFilter.startDate, dateFilter.endDate);
      }

      query += `
        GROUP BY ko.id, ko.kotNumber, c.name, ko.createdAt
        ORDER BY ko.createdAt DESC
      `;

      console.log('Executing sales query:', query, 'with params:', params);
      let sales = await db.getAllAsync(query, params);
      console.log('Sales query returned:', sales.length, 'rows');

      // If no results and we used menuItemId, try with itemId
      if (sales.length === 0) {
        console.log('No sales found with menuItemId, trying with itemId...');
        let altQuery = `
          SELECT 
            ko.id,
            ko.kotNumber,
            c.name as customerName,
            ko.createdAt,
            COALESCE(SUM(ki.quantity * ki.priceAtTime), 0) as totalAmount,
            GROUP_CONCAT(
              mi.name || ' x' || ki.quantity || ' @' || ki.priceAtTime,
              ', '
            ) as items
          FROM kot_orders ko
          LEFT JOIN customers c ON ko.customerId = c.id
          LEFT JOIN kot_items ki ON ko.id = ki.kotId
          LEFT JOIN menu_items mi ON ki.itemId = mi.id
        `;

        if (dateFilter) {
          altQuery += ` WHERE DATE(ko.createdAt) BETWEEN DATE(?) AND DATE(?)`;
        }

        altQuery += `
          GROUP BY ko.id, ko.kotNumber, c.name, ko.createdAt
          ORDER BY ko.createdAt DESC
        `;

        console.log('Executing alternative sales query:', altQuery);
        sales = await db.getAllAsync(altQuery, params);
        console.log('Alternative sales query returned:', sales.length, 'rows');
      }

      // If still no results, try simple query without joins
      if (sales.length === 0) {
        console.log('No sales found with joins, trying simple query...');
        let simpleQuery = `SELECT * FROM kot_orders ko LEFT JOIN customers c ON ko.customerId = c.id`;
        
        if (dateFilter) {
          simpleQuery += ` WHERE DATE(ko.createdAt) BETWEEN DATE(?) AND DATE(?)`;
        }
        
        simpleQuery += ` ORDER BY ko.createdAt DESC`;
        
        const simpleSales = await db.getAllAsync(simpleQuery, params);
        console.log('Simple sales query returned:', simpleSales.length, 'rows');
        
        if (simpleSales.length > 0) {
          sales = simpleSales.map((row: any) => ({
            id: row.id,
            kotNumber: row.kotNumber,
            customerName: row.name || 'Unknown',
            createdAt: row.createdAt,
            totalAmount: 0,
            items: 'No items data'
          }));
        }
      }

      const headers = [
        'id', 'kotNumber', 'customerName', 'createdAt', 'totalAmount', 'items'
      ];

      const csvContent = this.generateCSV(sales as any[], headers);
      
      const fileName = `sales_export_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return fileUri;
    } catch (error) {
      console.error('Error exporting sales:', error);
      throw new Error('Failed to export sales data');
    }
  }

  // Export all data
  async exportAllData(dateFilter?: { startDate: string; endDate: string }): Promise<string[]> {
    const fileUris: string[] = [];
    
    try {
      console.log('Starting export all data with filter:', dateFilter);
      
      // Export customers
      const customersFile = await this.exportCustomers(dateFilter);
      fileUris.push(customersFile);
      
      // Export expenses
      const expensesFile = await this.exportExpenses(dateFilter);
      fileUris.push(expensesFile);
      
      // Export sales
      const salesFile = await this.exportSales(dateFilter);
      fileUris.push(salesFile);
      
      console.log('Export all data completed, files:', fileUris);
      return fileUris;
    } catch (error) {
      console.error('Error exporting all data:', error);
      throw new Error('Failed to export all data');
    }
  }

  // Share exported files
  async shareFiles(fileUris: string[]): Promise<void> {
    try {
      if (fileUris.length === 1) {
        await Sharing.shareAsync(fileUris[0]);
      } else {
        // For multiple files, share them one by one
        for (const fileUri of fileUris) {
          await Sharing.shareAsync(fileUri);
        }
      }
    } catch (error) {
      console.error('Error sharing files:', error);
      throw new Error('Failed to share exported files');
    }
  }

  // Test database connection and tables
  async testDatabase(): Promise<void> {
    try {
      console.log('Testing database connection...');
      const tableInfo = await debugService.getTableInfo();
      console.log('Database tables:', tableInfo);
      
      const dataCheck = await debugService.checkDataExists();
      console.log('Data exists check:', dataCheck);
      
      const sampleData = await debugService.getSampleData();
      console.log('Sample data:', sampleData);
    } catch (error) {
      console.error('Database test failed:', error);
      throw error;
    }
  }
}

export const excelExportService = new ExcelExportService();
