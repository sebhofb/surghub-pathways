import React from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet,
  TouchableOpacity, Linking, SafeAreaView,
} from 'react-native';

const VERSION = '1.0.0';

const LINKS = [
  { label: 'Visit GSF Website', url: 'https://www.globalsurgeryfoundation.org' },
  { label: 'SURGhub Platform', url: 'https://www.surghub.org' },
  { label: 'Contact Us', url: 'mailto:info@globalsurgeryfoundation.org' },
];

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/gsf-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* App name + tagline */}
        <Text style={styles.appName}>SURGpath</Text>
        <Text style={styles.tagline}>
          Fellowships, grants & conferences for surgical care in low- and middle-income countries
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* About blurb */}
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.body}>
          SURGpath is a curated directory of opportunities for healthcare professionals
          working in global surgical care. Updated daily, it brings together fellowships,
          scholarships, grants, conferences, and research calls from leading organisations
          around the world — so you never miss an opportunity to grow.
        </Text>

        <Text style={styles.body}>
          Opportunities are reviewed for relevance to surgical care, anaesthesia, obstetrics,
          trauma, and related fields in LMICs, and are sourced from trusted organisations
          including COSECSA, WACS, PAACS, InciSioN, ACS, and more.
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Links */}
        <Text style={styles.sectionTitle}>Links</Text>
        {LINKS.map(link => (
          <TouchableOpacity
            key={link.url}
            style={styles.linkRow}
            onPress={() => Linking.openURL(link.url)}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>{link.label}</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Footer */}
        <Text style={styles.copyright}>
          © {new Date().getFullYear()} The Global Surgery Foundation
        </Text>
        <Text style={styles.version}>Version {VERSION}</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const BLUE  = '#1a3a5c';
const GREEN = '#0468B1';
const LIGHT = '#f0f4f8';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 48,
    alignItems: 'center',
  },

  /* Logo */
  logoWrap: {
    width: 110,
    height: 110,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  logo: {
    width: 90,
    height: 90,
  },

  /* Headings */
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: BLUE,
    textAlign: 'center',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  /* Sections */
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e8edf2',
    marginVertical: 24,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '700',
    color: GREEN,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    marginBottom: 12,
    alignSelf: 'stretch',
  },

  /* Links */
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f5',
  },
  linkText: {
    fontSize: 15,
    color: BLUE,
    fontWeight: '500',
  },
  linkArrow: {
    fontSize: 20,
    color: '#aab',
    marginTop: -2,
  },

  /* Footer */
  copyright: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  version: {
    fontSize: 12,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 4,
  },
});
