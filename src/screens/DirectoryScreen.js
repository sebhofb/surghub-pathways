import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OPPORTUNITIES, CATEGORIES } from '../data/opportunities';
import { loadOpportunities } from '../services/airtable';
import OpportunityCard from '../components/OpportunityCard';

const BLUE = '#0468B1';

function daysUntil(dateStr) {
  const deadline = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
}

function sortItems(items) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [...items].sort((a, b) => {
    if (a.isSponsored && !b.isSponsored) return -1;
    if (!a.isSponsored && b.isSponsored) return 1;
    const da = new Date(a.deadline);
    const db = new Date(b.deadline);
    const aOpen = da >= today;
    const bOpen = db >= today;
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    return da - db;
  });
}

export default function DirectoryScreen({ navigation }) {
  const [opportunities, setOpportunities] = useState(sortItems(OPPORTUNITIES));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [closingSoon, setClosingSoon] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const flatListRef = useRef(null);

  async function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const { data, stale } = await loadOpportunities({ force: isRefresh });
      setOpportunities(sortItems(data));
      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setSyncStatus(stale ? 'Offline — cached data' : `Synced ${now}`);
    } catch (e) {
      setSyncStatus('Using local data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadData(); }, []);
  const onRefresh = useCallback(() => loadData(true), []);

  const filtered = useMemo(() => {
    let items = opportunities;
    if (activeCategory) items = items.filter((o) => o.category === activeCategory);
    if (closingSoon) items = items.filter((o) => { const d = daysUntil(o.deadline); return d >= 0 && d <= 30; });
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((o) =>
        o.title.toLowerCase().includes(q) ||
        o.organization.toLowerCase().includes(q) ||
        (Array.isArray(o.tags) && o.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }
    return items;
  }, [opportunities, searchQuery, activeCategory, closingSoon]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={BLUE} />
        <Text style={styles.loadingText}>Loading opportunities...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Search bar with clear button */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search fellowships, grants, tags..."
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.pill, !activeCategory && !closingSoon && styles.pillActive]}
          onPress={() => { setActiveCategory(null); setClosingSoon(false); }}
        >
          <Text style={[styles.pillText, !activeCategory && !closingSoon && styles.pillTextActive]}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, closingSoon && styles.pillUrgent]}
          onPress={() => { setClosingSoon(!closingSoon); setActiveCategory(null); }}
        >
          <Text style={[styles.pillText, closingSoon && styles.pillTextActive]}>⏰ Closing Soon</Text>
        </TouchableOpacity>

        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.pill, activeCategory === cat.id && styles.pillActive]}
            onPress={() => { setActiveCategory(activeCategory === cat.id ? null : cat.id); setClosingSoon(false); }}
          >
            <Text style={[styles.pillText, activeCategory === cat.id && styles.pillTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.resultCount}>{filtered.length} opportunities</Text>
        <Text style={styles.syncedText}>{syncStatus}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OpportunityCard
            item={item}
            onPress={() => navigation.navigate('Detail', { item })}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No matches found. Try a different search or filter.</Text>
        }
        ListFooterComponent={
          filtered.length > 0
            ? <Text style={styles.footer}>© {new Date().getFullYear()} The Global Surgery Foundation</Text>
            : null
        }
        contentContainerStyle={{ paddingBottom: 16, paddingTop: 4 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} colors={[BLUE]} />
        }
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
        scrollEventThrottle={100}
      />

      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopBtn}
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-up" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fa',
  },
  loadingText: {
    textAlign: 'center',
    color: '#aaa',
    marginTop: 12,
    fontSize: 14,
  },

  /* Search */
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a2e',
  },
  clearBtn: {
    paddingLeft: 6,
  },

  /* Filters */
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 6,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pillActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  pillUrgent: {
    backgroundColor: '#FF9734',
    borderColor: '#FF9734',
  },
  pillText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#fff',
  },

  /* Meta row */
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  resultCount: {
    fontSize: 12,
    color: '#888',
  },
  syncedText: {
    fontSize: 11,
    color: '#aaa',
  },

  /* Scroll to top */
  scrollTopBtn: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -20,
    backgroundColor: BLUE,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },

  /* Misc */
  empty: {
    textAlign: 'center',
    color: '#aaa',
    marginTop: 60,
    fontSize: 14,
  },
  footer: {
    textAlign: 'center',
    color: '#bbb',
    fontSize: 11,
    paddingVertical: 20,
  },
});
