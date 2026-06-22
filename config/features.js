// Corporate Feature Flags Configuration
// Prevents cross-feature corruption by isolating functionality

const features = {
  // Wizard Parser (v30)
  wizard_parser_v30: {
    enabled: true,
    api_prefix: '/api/v2',
    routes: {
      parser: '/parser',
      batch: '/parser/batch',
      status: '/parser/status'
    },
    tables: {
      sessions: 'wizard_parse_sessions',
      results: 'wizard_parse_results',
      memos: 'wizard_parse_memos'
    }
  },

  // CAPS Parser (v9)
  caps_parser_v9: {
    enabled: true,
    api_prefix: '/api/v1',
    routes: {
      parse_topics: '/caps/parse-topics',
      seed_topics: '/caps/seed-topics',
      subjects: '/caps/subjects',
      topics: '/caps/topics',
      subtopics: '/caps/subtopics'
    },
    tables: {
      topics: 'lookup_caps_topics',
      subtopics: 'lookup_caps_subtopics',
      atp: 'caps_atp_content',
      poa: 'caps_poa_template'
    }
  },

  // Batch Processing
  batch_processing: {
    enabled: true,
    api_prefix: '/api/v2',
    max_concurrent: 5,
    timeout_ms: 300000
  },

  // Legacy Compatibility (redirects to v2)
  legacy_routes: {
    enabled: true,
    redirect_to_v2: true
  }
};

function isEnabled(featureName) {
  return features[featureName]?.enabled === true;
}

function getApiPrefix(featureName) {
  return features[featureName]?.api_prefix || '/api';
}

function getRoute(featureName, routeName) {
  const prefix = getApiPrefix(featureName);
  const route = features[featureName]?.routes?.[routeName] || '';
  return prefix + route;
}

module.exports = { features, isEnabled, getApiPrefix, getRoute };
