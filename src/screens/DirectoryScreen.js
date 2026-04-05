import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, RefreshControl, ActivityIndicator,
  Animated,
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

  // Filter show/hide — opacity on native thread, height via state after animation
  const filterAnim      = useRef(new Animated.Value(1)).current;
  const [filterGone, setFilterGone] = useState(false); // true = height:0 applied
  const filterShown     = useRef(true);
  const lastScrollY     = useRef(0);
  const directionRef    = useRef(null);   // 'up' | 'down'
  const dirStartY       = useRef(0);      // Y where current direction streak began
  const TRIGGER_PX      = 24;            // must scroll this far in one direction to toggle

  function showFilters() {
    if (filterShown.current) return;
    filterShown.current = true;
    setFilterGone(false); // restore height before fading in
    Animated.timing(filterAnim, {
      toValue: 1, duration: 180, useNativeDriver: true,
    }).start();
  }

  function hideFilters() {
    if (!filterShown.current) return;
    filterShown.current = false;
    Animated.timing(filterAnim, {
      toValue: 0, duration: 180, useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setFilterGone(true); // collapse height after fade-out completes
    });
  }

  function onScroll(e) {
    const y   = e.nativeEvent.contentOffset.y;
    const dir = y > lastScrollY.current ? 'down' : 'up';
    lastScrollY.current = y;

    if (y < 10) { showFilters(); directionRef.current = null; return; }

    // Reset streak when direction changes
    if (dir !== directionRef.current) {
      directionRef.current = dir;
      dirStartY.current    = y;
      return;
    }

    // Only act after scrolling TRIGGER_PX in a consistent direction
    if (Math.abs(y - dirStartY.current) < TRIGGER_PX) return;

    if (dir === 'down') hideFilters();
    else                showFilters();
  }

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

      {/* Filter pills — fade out then collapse height */}
      <Animated.View style={[styles.filterRow, { opacity: filterAnim }, filterGone && styles.filterHidden]}>
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
      </Animated.View>

      <View style={styles.metaRow}>
        <Text style={styles.resultCount}>{filtered.length} opportunities</Text>
        <Text style={styles.syncedText}>{syncStatus}</Text>
      </View>

      <FlatList
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
        onScroll={onScroll}
        scrollEventThrottle={16}
      />
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
  filterHidden: {
    height: 0,
    overflow: 'hidden',
    paddingBottom: 0,
  },
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
