import { Typography } from '@/components/ui';
import { theme } from '@/constants/theme';
import { excelExportService } from '@/services/excelExportService';
import { Activity, Calendar, Download, FileText, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ExportModal({ visible, onClose }: ExportModalProps) {
  const [exportType, setExportType] = useState<'customers' | 'expenses' | 'sales' | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const getDateFilter = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (dateFilter) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        return { 
          startDate: weekStart.toISOString().split('T')[0], 
          endDate: todayStr 
        };
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { 
          startDate: monthStart.toISOString().split('T')[0], 
          endDate: todayStr 
        };
      case 'custom':
        if (!startDate || !endDate) return undefined;
        return { startDate, endDate };
      default:
        return undefined;
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      console.log('Starting export process...');
      const dateFilterData = getDateFilter();
      console.log('Date filter:', dateFilterData);
      
      // Test database first
      await excelExportService.testDatabase();
      
      let fileUris: string[] = [];
      
      switch (exportType) {
        case 'customers':
          const customersFile = await excelExportService.exportCustomers(dateFilterData);
          fileUris = [customersFile];
          break;
        case 'expenses':
          const expensesFile = await excelExportService.exportExpenses(dateFilterData);
          fileUris = [expensesFile];
          break;
        case 'sales':
          const salesFile = await excelExportService.exportSales(dateFilterData);
          fileUris = [salesFile];
          break;
        case 'all':
          fileUris = await excelExportService.exportAllData(dateFilterData);
          break;
      }
      
      if (fileUris.length > 0) {
        await excelExportService.shareFiles(fileUris);
        Alert.alert('Success', 'Data exported successfully!');
      } else {
        Alert.alert('Warning', 'No files were generated. Please check if data exists.');
      }
      
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to export data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const ExportTypeCard = ({ 
    type, 
    title, 
    description, 
    icon, 
    selected, 
    onPress 
  }: {
    type: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    selected: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[
        styles.exportCard,
        selected && styles.exportCardSelected
      ]}
      onPress={onPress}
    >
      <View style={[
        styles.iconContainer,
        { backgroundColor: selected ? theme.colors.primaryLight : '#F8FAFC' }
      ]}>
        {icon}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Typography variant="body" weight="bold" style={{ 
          color: selected ? theme.colors.primary : '#1E293B',
          marginBottom: 4
        }}>
          {title}
        </Typography>
        <Typography variant="caption" style={{ 
          color: '#64748B',
          lineHeight: 16
        }}>
          {description}
        </Typography>
      </View>
      <View style={[
        styles.radioButton,
        selected && styles.radioButtonSelected
      ]}>
        {selected && <View style={styles.radioButtonInner} />}
      </View>
    </TouchableOpacity>
  );

  const DateFilterButton = ({ 
    filter, 
    label, 
    selected, 
    onPress 
  }: {
    filter: string;
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[
        styles.dateFilterButton,
        selected && styles.dateFilterButtonSelected
      ]}
      onPress={onPress}
    >
      <Typography style={{
        color: selected ? 'white' : theme.colors.textSecondary,
        fontWeight: '600',
        fontSize: 13
      }}>
        {label}
      </Typography>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Typography variant="h3" weight="bold" style={{ color: '#1E293B', marginBottom: 4 }}>
                Export Data
              </Typography>
              <Typography variant="caption" style={{ color: '#64748B' }}>
                Choose what data to export and date range
              </Typography>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Export Type Selection */}
            <View style={styles.section}>
              <Typography variant="h4" weight="bold" style={{ color: '#1E293B', marginBottom: 16 }}>
                What to Export
              </Typography>
              
              <ExportTypeCard
                type="all"
                title="All Data"
                description="Export customers, expenses, and sales data"
                icon={<FileText size={24} color={exportType === 'all' ? theme.colors.primary : '#64748B'} />}
                selected={exportType === 'all'}
                onPress={() => setExportType('all')}
              />

              <ExportTypeCard
                type="customers"
                title="Customers"
                description="Customer details, orders, and payment history"
                icon={<FileText size={24} color={exportType === 'customers' ? theme.colors.primary : '#64748B'} />}
                selected={exportType === 'customers'}
                onPress={() => setExportType('customers')}
              />

              <ExportTypeCard
                type="expenses"
                title="Expenses"
                description="All expense records and voucher details"
                icon={<FileText size={24} color={exportType === 'expenses' ? theme.colors.primary : '#64748B'} />}
                selected={exportType === 'expenses'}
                onPress={() => setExportType('expenses')}
              />

              <ExportTypeCard
                type="sales"
                title="Sales"
                description="Order details, items sold, and revenue data"
                icon={<FileText size={24} color={exportType === 'sales' ? theme.colors.primary : '#64748B'} />}
                selected={exportType === 'sales'}
                onPress={() => setExportType('sales')}
              />
            </View>

            {/* Date Range Selection */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Calendar size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Typography variant="h4" weight="bold" style={{ color: '#1E293B' }}>
                  Date Range
                </Typography>
              </View>

              <View style={styles.dateFilterContainer}>
                <DateFilterButton
                  filter="all"
                  label="All Time"
                  selected={dateFilter === 'all'}
                  onPress={() => setDateFilter('all')}
                />
                <DateFilterButton
                  filter="today"
                  label="Today"
                  selected={dateFilter === 'today'}
                  onPress={() => setDateFilter('today')}
                />
                <DateFilterButton
                  filter="week"
                  label="This Week"
                  selected={dateFilter === 'week'}
                  onPress={() => setDateFilter('week')}
                />
                <DateFilterButton
                  filter="month"
                  label="This Month"
                  selected={dateFilter === 'month'}
                  onPress={() => setDateFilter('month')}
                />
                <DateFilterButton
                  filter="custom"
                  label="Custom"
                  selected={dateFilter === 'custom'}
                  onPress={() => setDateFilter('custom')}
                />
              </View>

              {/* Custom Date Inputs */}
              {dateFilter === 'custom' && (
                <View style={styles.customDateContainer}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Typography variant="caption" style={{ color: '#64748B', marginBottom: 8 }}>
                      Start Date
                    </Typography>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="YYYY-MM-DD"
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Typography variant="caption" style={{ color: '#64748B', marginBottom: 8 }}>
                      End Date
                    </Typography>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="YYYY-MM-DD"
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Export Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.exportButton,
                loading && styles.exportButtonDisabled
              ]}
              onPress={handleExport}
              disabled={loading || (dateFilter === 'custom' && (!startDate || !endDate))}
            >
              {loading ? (
                <Activity size={20} color="white" style={{ marginRight: 8 }} />
              ) : (
                <Download size={20} color="white" style={{ marginRight: 8 }} />
              )}
              <Typography style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                {loading ? 'Exporting...' : 'Export Data'}
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  closeButton: {
    padding: 8,
    marginTop: -8,
    marginRight: -8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  exportCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight + '20',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: theme.colors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateFilterButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  customDateContainer: {
    flexDirection: 'row',
    marginTop: 16,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: 'white',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  exportButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  exportButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
});
