import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, Linking, Share, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSaved } from '../context/SavedContext';

// ── GSF Brand Palette ─────────────────────────────────────────────
const BLUE   = '#0468B1';
const NAVY   = '#002F4C';
const GREEN  = '#7ECC25';
const ORANGE = '#FF9734';

function formatDeadline(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(dateStr) {
  const deadline = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
}

function addToCalendar(item) {
  const deadline = new Date(item.deadline);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const start = new Date(deadline);
  start.setHours(9, 0, 0, 0);
  const end = new Date(deadline);
  end.setHours(10, 0, 0, 0);
  const details = encodeURIComponent(`${item.organization}\n\n${item.summary}`);
  const title = encodeURIComponent(`DEADLINE: ${item.title}`);
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
  Linking.openURL(url);
}

export default function DetailScreen({ route }) {
  const { item } = route.params;
  const { savedIds, toggleSaved } = useSaved();
  const isSaved = savedIds.has(item.id);
  const days = daysUntil(item.deadline);
  const isPast = days < 0;
  const isUrgent = days >= 0 && days <= 14;

  function handleShare() {
    Share.share({
      message: `${item.title}\n${item.organization} · ${item.location}\nDeadline: ${formatDeadline(item.deadline)}\n\n${item.summary}${item.url ? '\n\nApply: ' + item.url : ''}\n\n— Discovered on SURGpath, the directory for global surgery opportunities.\nDownload on iOS & Android: https://surghub.org/pathways`,
      title: item.title,
    });
  }

  function handleApply() {
    if (!item.url) {
      Alert.alert('No link available', 'Check back soon — a direct link will be added.');
      return;
    }
    Linking.openURL(item.url);
  }

  function handleReminder() {
    Alert.alert(
      'Add deadline to calendar',
      'This will open Google Calendar so you can save the deadline date.',
      [
        { text: 'Open Calendar', onPress: () => addToCalendar(item) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.category}>{item.category.toUpperCase()}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.org}>{item.organization}</Text>
        <Text style={styles.location}>📍 {item.location}</Text>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleSaved(item.id)}>
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isSaved ? BLUE : '#555'}
            />
            <Text style={[styles.actionLabel, isSaved && styles.actionLabelActive]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#555" />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          {!isPast && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleReminder}>
              <Ionicons name="alarm-outline" size={20} color="#555" />
              <Text style={styles.actionLabel}>Remind me</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Deadline box */}
        <View style={[
          styles.deadlineBox,
          isUrgent && !isPast && styles.urgentBox,
          isPast && styles.pastBox,
        ]}>
          <Text style={[
            styles.deadlineLabel,
            isUrgent && !isPast && styles.urgentText,
            isPast && styles.pastText,
          ]}>
            {isPast
              ? 'This opportunity has closed.'
              : `⏰ Deadline: ${formatDeadline(item.deadline)}`}
          </Text>
          {!isPast && (
            <Text style={[styles.daysLeft, isUrgent && styles.urgentText]}>
              {days === 0 ? 'Due today!' : `${days} day${days !== 1 ? 's' : ''} remaining`}
            </Text>
          )}
        </View>

        <Text style={styles.sectionHeading}>About this opportunity</Text>
        <Text style={styles.summary}>{item.summary}</Text>

        {!!item.relevanceNote && (
          <View style={styles.relevanceBox}>
            <Text style={styles.relevanceIcon}>💡</Text>
            <Text style={styles.relevanceText}>{item.relevanceNote}</Text>
          </View>
        )}

        <Text style={styles.sectionHeading}>Tags</Text>
        <View style={styles.tagRow}>
          {(item.tags || []).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Apply button */}
        <TouchableOpacity
          style={[styles.applyBtn, isPast && styles.applyBtnDisabled]}
          onPress={handleApply}
          disabled={isPast}
        >
          <Ionicons name="open-outline" size={18} color="#fff" />
          <Text style={styles.applyBtnText}>
            {isPast ? 'Applications Closed' : 'Apply Now'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fa',
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },
  category: {
    fontSize: 11,
    fontWeight: '700',
    color: BLUE,
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 6,
    lineHeight: 27,
  },
  org: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    fontWeight: '500',
  },
  location: {
    fontSize: 13,
    color: '#777',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    color: '#555',
    fontWeight: '500',
  },
  actionLabelActive: {
    color: BLUE,
    fontWeight: '700',
  },
  deadlineBox: {
    backgroundColor: '#deeaf5',   // light tint of #91B5D9
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  urgentBox: {
    backgroundColor: '#fff1e0',
  },
  pastBox: {
    backgroundColor: '#f5f5f5',
  },
  deadlineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: NAVY,
  },
  daysLeft: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
  },
  urgentText: {
    color: ORANGE,
  },
  pastText: {
    color: '#aaa',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: NAVY,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summary: {
    fontSize: 15,
    color: '#333',
    lineHeight: 23,
    marginBottom: 12,
  },
  relevanceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eef8d6',   // light tint of #7ECC25
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  relevanceIcon: {
    fontSize: 14,
    lineHeight: 20,
  },
  relevanceText: {
    flex: 1,
    fontSize: 13,
    color: '#3a6600',
    fontStyle: 'italic',
    lineHeight: 19,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  tag: {
    backgroundColor: '#deeaf5',   // light tint of #91B5D9
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: NAVY,
    fontWeight: '500',
  },
  applyBtn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyBtnDisabled: {
    backgroundColor: '#bbb',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
