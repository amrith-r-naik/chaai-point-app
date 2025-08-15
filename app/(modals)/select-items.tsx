import { use$ } from '@legendapp/state/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Minus, Plus, Search, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, LayoutChangeEvent, Platform, ScrollView, SectionList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CATEGORIES, getCategoryEmoji } from '../../constants/appConstants';
import { theme } from '../../constants/theme';
import { MenuItem, orderService } from '../../services/orderService';
import { orderState } from '../../state/orderState';

// ---- Constants ----
const ITEM_HEIGHT = 60;
const ITEM_SPACING = 6;
const HEADER_HEIGHT = 32;

// ---- Helpers ----
interface Section { title: string; data: MenuItem[]; }

// Simple debounce hook (local, minimal)
function useDebounce<T>(value: T, delay = 220) {
  const [d, setD] = useState(value);
  useEffect(() => { const id = setTimeout(() => setD(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return d;
}

// ---- Item Row ----
interface ItemRowProps { item: MenuItem; qty: number; onChange: (q: number) => void; }
const ItemRow: React.FC<ItemRowProps> = React.memo(({ item, qty, onChange }) => {
  const [local, setLocal] = useState(qty || 1);
  // Keep local in sync only when external qty changes (avoid reset while typing fast)
  useEffect(() => { if (qty === 0) setLocal(1); else if (qty !== local) setLocal(qty); }, [qty]); // eslint-disable-line react-hooks/exhaustive-deps
  const inc = () => {
    const n = local + 1; setLocal(n); if (qty > 0) onChange(n); // Only propagate if already added
  };
  const dec = () => {
    if (local > 1) { const n = local - 1; setLocal(n); if (qty > 0) onChange(n); }
    else if (qty > 0) onChange(0);
  };
  const add = () => onChange(local);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, height: ITEM_HEIGHT, marginBottom: ITEM_SPACING, borderWidth: qty ? 2 : 1, borderColor: qty ? theme.colors.primary : '#e2e5e8' }}>
      <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#f2f3f5', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
        <Text style={{ fontSize: 20 }}>{getCategoryEmoji(item.category)}</Text>
      </View>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }} numberOfLines={1}>{item.name}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.primary, marginTop: 4 }}>₹{item.price}</Text>
      </View>
      {qty ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 16, paddingHorizontal: 4, height: 32 }}>
          <TouchableOpacity onPress={dec} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' }}><Minus size={14} color='#fff' /></TouchableOpacity>
          <Text style={{ width: 24, textAlign: 'center', fontWeight: '700', fontSize: 14, color: theme.colors.primary }}>{local}</Text>
          <TouchableOpacity onPress={inc} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' }}><Plus size={14} color='#fff' /></TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={add} style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 12, height: 32, borderRadius: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Plus size={14} color='#fff' style={{ marginRight: 3 }} />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.qty === next.qty);

// ---- Main Component ----
export default function SelectItemsModal() {
  const router = useRouter();
  const order$ = use$(orderState);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recentItems, setRecentItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 220);
  const [category, setCategory] = useState<string>('All');
  const listRef = useRef<SectionList<MenuItem>>(null);
  const [showSelectedSheet, setShowSelectedSheet] = useState(false);
  const pendingJumpItemIdRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Recent searches dropdown state
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  // Dynamic top position for dropdown (measured from search bar) so spacing is tight & consistent
  const [searchDropdownTop, setSearchDropdownTop] = useState(60);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load menu, recents (items) and stored recent search terms
  useEffect(() => {
    let mounted = true; (async () => {
      try {
        const [hardcoded, recent, storedSearches] = await Promise.all([
          orderService.getHardcodedMenuItems(),
          (async () => { try { return await orderService.getRecentlyOrderedItems(8); } catch { return []; } })(),
          AsyncStorage.getItem('recentSearchTerms').catch(() => null)
        ]);
        if (!mounted) return;
        setMenuItems(hardcoded);
        setRecentItems(recent as MenuItem[]);
        if (storedSearches) { try { const arr = JSON.parse(storedSearches); if (Array.isArray(arr)) setRecentSearches(arr.slice(0, 10)); } catch { } }
      } finally { if (mounted) setLoading(false); }
    })(); return () => { mounted = false; if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); };
  }, []);

  const categories = useMemo(() => ['All', ...CATEGORIES.map(c => c.name)], []);

  // Pre-lowered names to avoid repeated toLowerCase during search
  const loweredItems = useMemo(() => menuItems.map(m => ({ m, nameLower: m.name.toLowerCase() })), [menuItems]);

  const sections: Section[] = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const filtered = term ? loweredItems.filter(obj => obj.nameLower.includes(term)).map(obj => obj.m) : menuItems;
    if (category !== 'All') {
      const data = filtered.filter(f => f.category === category);
      return data.length ? [{ title: category, data }] : [];
    }
    const group: Record<string, MenuItem[]> = {};
    filtered.forEach(m => { const k = m.category || 'Uncategorized'; (group[k] = group[k] || []).push(m); });
    const ordered: Section[] = [];
    // Quick section (recent items) only when no search & All view
    if (!term && recentItems.length) {
      // Filter out items not present anymore and dedupe by id
      const recentsFiltered: MenuItem[] = [];
      const seen = new Set<string>();
      for (const r of recentItems) { if (!seen.has(r.id) && filtered.find(f => f.id === r.id)) { seen.add(r.id); recentsFiltered.push(r); } }
      if (recentsFiltered.length) ordered.push({ title: 'Quick', data: recentsFiltered.slice(0, 8) });
    }
    CATEGORIES.forEach(c => { if (group[c.name]) ordered.push({ title: c.name, data: group[c.name] }); });
    Object.keys(group).filter(k => !CATEGORIES.find(c => c.name === k)).sort().forEach(k => ordered.push({ title: k, data: group[k] }));
    return ordered;
  }, [menuItems, debouncedSearch, category, recentItems]);

  // Helper to add a recent search term
  const addRecentSearch = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setRecentSearches(prev => {
      const next = [t, ...prev.filter(p => p.toLowerCase() !== t.toLowerCase())].slice(0, 10);
      AsyncStorage.setItem('recentSearchTerms', JSON.stringify(next)).catch(() => { });
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem('recentSearchTerms').catch(() => { });
  };

  // Category quantity map
  const categoryQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    order$.selectedItems.forEach(si => { const cat = si.item.category || 'Uncategorized'; map[cat] = (map[cat] || 0) + si.quantity; });
    return map;
  }, [order$.selectedItems]);

  // Quantity map for O(1) lookup per row (avoids .find on each render)
  const quantityMap = useMemo(() => {
    const m: Record<string, number> = {};
    order$.selectedItems.forEach(si => { m[si.item.id] = si.quantity; });
    return m;
  }, [order$.selectedItems]);

  const getQty = (id: string) => quantityMap[id] || 0;
  const setQty = (item: MenuItem, qty: number) => {
    const current = orderState.selectedItems.get();
    const list = [...current];
    const idx = list.findIndex(l => l.item.id === item.id);
    if (qty <= 0) {
      if (idx !== -1) list.splice(idx, 1);
    } else if (idx === -1) {
      list.push({ item, quantity: qty });
    } else {
      list[idx] = { ...list[idx], quantity: qty };
    }
    orderState.selectedItems.set(list);
  };

  const totalItems = order$.selectedItems.reduce((t, s) => t + s.quantity, 0);
  const totalAmount = order$.selectedItems.reduce((t, s) => t + s.quantity * s.item.price, 0);

  const scrollToCategory = (cat: string) => {
    setCategory(cat);
    if (cat === 'All') return; // nothing to scroll because we rebuild sections
    if (cat !== 'All' && category === 'All') {
      const index = sections.findIndex(s => s.title === cat);
      if (index !== -1) {
        try { listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, animated: true, viewPosition: 0 }); } catch { }
      }
    }
  };

  // Jump to a particular item (used from selected items sheet)
  const jumpToItem = (itemId: string) => {
    // Clear search so item will be visible (show soft notice)
    if (search.length) {
      setSearch('');
      setNotice('Search cleared to locate item');
      setTimeout(() => setNotice(null), 2200);
    }
    // Ensure we're in full list mode
    if (category !== 'All') {
      pendingJumpItemIdRef.current = itemId;
      setCategory('All');
      return;
    }
    // Already in All view; attempt immediate scroll
    setTimeout(() => {
      for (let s = 0; s < sections.length; s++) {
        const ix = sections[s].data.findIndex(i => i.id === itemId);
        if (ix !== -1) {
          try { listRef.current?.scrollToLocation({ sectionIndex: s, itemIndex: ix, animated: true, viewPosition: 0 }); } catch { }
          break;
        }
      }
    }, 30);
  };

  // After category switches to All, if we had a pending item jump, perform it
  useEffect(() => {
    if (category === 'All' && pendingJumpItemIdRef.current) {
      const id = pendingJumpItemIdRef.current;
      pendingJumpItemIdRef.current = null;
      jumpToItem(id);
    }
  }, [category, sections]);

  // ---- Typed handlers to satisfy strict TS ----
  const handleSearchLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    const top = y + height + 4;
    if (Math.abs(top - searchDropdownTop) > 1) setSearchDropdownTop(top);
  };

  const handleChangeSearchText = (text: string) => {
    setSearch(text);
    if (!showSearchDropdown) setShowSearchDropdown(true);
  };

  const keyExtractorFn = (item: MenuItem) => item.id;

  const renderItemFn = ({ item }: { item: MenuItem }) => (
    <ItemRow item={item} qty={getQty(item.id)} onChange={(q: number) => setQty(item, q)} />
  );

  const renderSectionHeaderFn = ({ section }: { section: Section }) => (
    <View style={{ height: HEADER_HEIGHT, justifyContent: 'flex-end', paddingBottom: 2 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text }}>
        {getCategoryEmoji(section.title)} {section.title}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{
        title: 'Select Items', headerStyle: { backgroundColor: '#fff' }, headerTitleStyle: { fontSize: 17, fontWeight: '600', color: theme.colors.text }, headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginLeft: -6 }}><ArrowLeft size={22} color={theme.colors.text} /></TouchableOpacity>
        ), headerShadowVisible: true
      }} />
      <View style={{ flex: 1 }}>
        {/* Search & Categories */}
        <View style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#eef1f3' }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
            onLayout={handleSearchLayout}
          >
            <Search size={20} color={theme.colors.textSecondary} />
            <TextInput
              placeholder='Search menu items...'
              value={search}
              onChangeText={handleChangeSearchText}
              style={{ flex: 1, fontSize: 14.5, color: theme.colors.text, marginLeft: 10, paddingVertical: Platform.OS === 'android' ? 0 : 4 }}
              placeholderTextColor={theme.colors.textSecondary}
              returnKeyType='search'
              onSubmitEditing={() => { Keyboard.dismiss(); addRecentSearch(search); setShowSearchDropdown(false); }}
              onFocus={() => setShowSearchDropdown(true)}
              onBlur={() => { blurTimeoutRef.current = setTimeout(() => setShowSearchDropdown(false), 120) as any; }}
            />
            {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><X size={18} color={theme.colors.textSecondary} /></TouchableOpacity>}
          </View>
          {/* Recent Search Dropdown */}
          {showSearchDropdown && recentSearches.length > 0 && (
            <View style={{ position: 'absolute', left: 14, right: 14, top: searchDropdownTop, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e3e5e8', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 12, zIndex: 50, maxHeight: 220, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eef1f3' }}>
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>Recent searches</Text>
                <TouchableOpacity onPress={clearRecentSearches} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.primary }}>Clear</Text>
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps='handled'>
                {recentSearches.map(rs => (
                  <TouchableOpacity key={rs} onPress={() => { setSearch(rs); addRecentSearch(rs); setShowSearchDropdown(false); Keyboard.dismiss(); }} style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f4f5f6' }}>
                    <Text style={{ fontSize: 13.5, color: theme.colors.text }}>{rs}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }} style={{ zIndex: 1 }}>
            {categories.map(cat => {
              const active = category === cat; return (
                <TouchableOpacity key={cat} onPress={() => scrollToCategory(cat)} style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: active ? theme.colors.primary : '#fff', borderWidth: 1, borderColor: active ? theme.colors.primary : '#e3e5e8', alignItems: 'center', justifyContent: 'center', marginRight: 8, position: 'relative' }}>
                  <Text style={{ color: active ? '#fff' : theme.colors.text, fontSize: 13, fontWeight: '600' }}>{cat}</Text>
                  {cat !== 'All' && categoryQuantities[cat] ? (
                    <View style={{ position: 'absolute', top: -6, right: -4, backgroundColor: active ? '#fff' : theme.colors.primary, minWidth: 18, paddingHorizontal: 4, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: active ? theme.colors.primary : '#fff', fontSize: 10, fontWeight: '700' }}>{categoryQuantities[cat]}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {notice && (
            <View style={{ backgroundColor: '#eef7ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: theme.colors.primary }}>{notice}</Text>
              <TouchableOpacity onPress={() => setNotice(null)} style={{ padding: 4 }}>
                <X size={14} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {/* List */}
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size='small' color={theme.colors.primary} /></View>
          ) : menuItems.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 50, marginBottom: 12 }}>🍽️</Text>
              <Text style={{ fontSize: 17, fontWeight: '600', color: theme.colors.text, marginBottom: 6 }}>No menu items</Text>
              <Text style={{ fontSize: 13.5, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>Menu will appear here once items are added.</Text>
            </View>
          ) : sections.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 46, marginBottom: 10 }}>🔍</Text>
              <Text style={{ fontSize: 16.5, fontWeight: '600', color: theme.colors.text, marginBottom: 6 }}>No matches</Text>
              <Text style={{ fontSize: 13.5, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>Try a different search term.</Text>
            </View>
          ) : (
            <SectionList<MenuItem, Section>
              ref={listRef}
              sections={sections}
              keyExtractor={keyExtractorFn}
              renderItem={renderItemFn}
              renderSectionHeader={renderSectionHeaderFn}
              stickySectionHeadersEnabled={category === 'All'}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode='on-drag'
              contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 10, paddingBottom: 120 }}
            />
          )}
        </View>
        {order$.selectedItems.length > 0 && (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop:8, paddingBottom: 20, backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 8 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text }} numberOfLines={1}>{totalItems} item{totalItems !== 1 ? 's' : ''} • ₹{totalAmount}</Text>
            <TouchableOpacity onPress={() => setShowSelectedSheet(true)} style={{ backgroundColor: '#f1f2f4', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22 }}>
              <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Selected Items Bottom Sheet */}
        {showSelectedSheet && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }}>
            {/* Backdrop */}
            <TouchableOpacity activeOpacity={1} onPress={() => setShowSelectedSheet(false)} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }} />
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '70%', paddingBottom: (order$.selectedItems.length ? 90 : 24), paddingHorizontal: 14, paddingTop: 10 }}>
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e1e3e6' }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '700', color: theme.colors.text }}>Selected Items ({totalItems})</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.primary }}>₹{totalAmount}</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {order$.selectedItems.map(si => (
                  <View key={si.item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f2f3f5' }}>
                    <TouchableOpacity onPress={() => { setShowSelectedSheet(false); jumpToItem(si.item.id); }} style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '600', color: theme.colors.text }} numberOfLines={1}>{si.item.name}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 2 }}>₹{si.item.price}</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 16, paddingHorizontal: 4, height: 32, marginRight: 6 }}>
                      <TouchableOpacity onPress={() => setQty(si.item, si.quantity - 1)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                        <Minus size={14} color='#fff' />
                      </TouchableOpacity>
                      <Text style={{ width: 26, textAlign: 'center', fontWeight: '700', fontSize: 14, color: theme.colors.primary }}>{si.quantity}</Text>
                      <TouchableOpacity onPress={() => setQty(si.item, si.quantity + 1)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                        <Plus size={14} color='#fff' />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setQty(si.item, 0)} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#d11' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {order$.selectedItems.length === 0 && (
                  <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>No items selected.</Text>
                  </View>
                )}
              </ScrollView>
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#edf0f2', backgroundColor: '#fff', borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{totalItems} item{totalItems !== 1 ? 's' : ''} • ₹{totalAmount}</Text>
                <TouchableOpacity onPress={() => { setShowSelectedSheet(false); router.back(); }} style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22 }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

