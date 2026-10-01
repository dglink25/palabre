/// Liste des fuseaux horaires africains disponibles dans le sélecteur de profil.
/// Groupés par région, format : { label, value, offset }
class AfricaTimezones {
  AfricaTimezones._();

  static const List<Map<String, String>> all = [
    // ── Afrique de l'Ouest ──────────────────────────────────────
    {'group': 'Afrique de l\'Ouest', 'label': 'Abidjan (UTC+0)',       'value': 'Africa/Abidjan'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Accra (UTC+0)',         'value': 'Africa/Accra'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Bamako (UTC+0)',        'value': 'Africa/Bamako'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Banjul (UTC+0)',        'value': 'Africa/Banjul'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Conakry (UTC+0)',       'value': 'Africa/Conakry'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Dakar (UTC+0)',         'value': 'Africa/Dakar'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Freetown (UTC+0)',      'value': 'Africa/Freetown'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Lomé (UTC+0)',          'value': 'Africa/Lome'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Monrovia (UTC+0)',      'value': 'Africa/Monrovia'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Nouakchott (UTC+0)',    'value': 'Africa/Nouakchott'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Ouagadougou (UTC+0)',   'value': 'Africa/Ouagadougou'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Lagos (UTC+1)',         'value': 'Africa/Lagos'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Porto-Novo (UTC+1)',    'value': 'Africa/Porto-Novo'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Niamey (UTC+1)',        'value': 'Africa/Niamey'},
    {'group': 'Afrique de l\'Ouest', 'label': 'N\'Djamena (UTC+1)',    'value': 'Africa/Ndjamena'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Libreville (UTC+1)',    'value': 'Africa/Libreville'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Douala (UTC+1)',        'value': 'Africa/Douala'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Bangui (UTC+1)',        'value': 'Africa/Bangui'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Brazzaville (UTC+1)',   'value': 'Africa/Brazzaville'},
    {'group': 'Afrique de l\'Ouest', 'label': 'Malabo (UTC+1)',        'value': 'Africa/Malabo'},
    // ── Afrique Centrale ─────────────────────────────────────────
    {'group': 'Afrique Centrale', 'label': 'Kinshasa (UTC+1)',         'value': 'Africa/Kinshasa'},
    {'group': 'Afrique Centrale', 'label': 'Lubumbashi (UTC+2)',       'value': 'Africa/Lubumbashi'},
    {'group': 'Afrique Centrale', 'label': 'Luanda (UTC+1)',           'value': 'Africa/Luanda'},
    {'group': 'Afrique Centrale', 'label': 'Kigali (UTC+2)',           'value': 'Africa/Kigali'},
    {'group': 'Afrique Centrale', 'label': 'Bujumbura (UTC+2)',        'value': 'Africa/Bujumbura'},
    // ── Afrique de l'Est ──────────────────────────────────────────
    {'group': 'Afrique de l\'Est', 'label': 'Addis-Abeba (UTC+3)',     'value': 'Africa/Addis_Ababa'},
    {'group': 'Afrique de l\'Est', 'label': 'Asmara (UTC+3)',          'value': 'Africa/Asmara'},
    {'group': 'Afrique de l\'Est', 'label': 'Dar es Salaam (UTC+3)',   'value': 'Africa/Dar_es_Salaam'},
    {'group': 'Afrique de l\'Est', 'label': 'Djibouti (UTC+3)',        'value': 'Africa/Djibouti'},
    {'group': 'Afrique de l\'Est', 'label': 'Kampala (UTC+3)',         'value': 'Africa/Kampala'},
    {'group': 'Afrique de l\'Est', 'label': 'Mogadiscio (UTC+3)',      'value': 'Africa/Mogadishu'},
    {'group': 'Afrique de l\'Est', 'label': 'Nairobi (UTC+3)',         'value': 'Africa/Nairobi'},
    {'group': 'Afrique de l\'Est', 'label': 'Djouba (UTC+3)',          'value': 'Africa/Juba'},
    {'group': 'Afrique de l\'Est', 'label': 'Khartoum (UTC+2)',        'value': 'Africa/Khartoum'},
    {'group': 'Afrique de l\'Est', 'label': 'Maputo (UTC+2)',          'value': 'Africa/Maputo'},
    {'group': 'Afrique de l\'Est', 'label': 'Harare (UTC+2)',          'value': 'Africa/Harare'},
    {'group': 'Afrique de l\'Est', 'label': 'Lusaka (UTC+2)',          'value': 'Africa/Lusaka'},
    {'group': 'Afrique de l\'Est', 'label': 'Antananarivo (UTC+3)',    'value': 'Africa/Antananarivo'},
    {'group': 'Afrique de l\'Est', 'label': 'Maurice (UTC+4)',         'value': 'Indian/Mauritius'},
    {'group': 'Afrique de l\'Est', 'label': 'La Réunion (UTC+4)',      'value': 'Indian/Reunion'},
    {'group': 'Afrique de l\'Est', 'label': 'Mayotte (UTC+3)',         'value': 'Indian/Mayotte'},
    // ── Afrique du Nord ──────────────────────────────────────────
    {'group': 'Afrique du Nord', 'label': 'Le Caire (UTC+2)',          'value': 'Africa/Cairo'},
    {'group': 'Afrique du Nord', 'label': 'Tripoli (UTC+2)',           'value': 'Africa/Tripoli'},
    {'group': 'Afrique du Nord', 'label': 'Tunis (UTC+1)',             'value': 'Africa/Tunis'},
    {'group': 'Afrique du Nord', 'label': 'Alger (UTC+1)',             'value': 'Africa/Algiers'},
    {'group': 'Afrique du Nord', 'label': 'Casablanca (UTC+1)',        'value': 'Africa/Casablanca'},
    {'group': 'Afrique du Nord', 'label': 'Laâyoune (UTC+1)',          'value': 'Africa/El_Aaiun'},
    // ── Afrique Australe ─────────────────────────────────────────
    {'group': 'Afrique Australe', 'label': 'Johannesburg (UTC+2)',     'value': 'Africa/Johannesburg'},
    {'group': 'Afrique Australe', 'label': 'Windhoek (UTC+2)',         'value': 'Africa/Windhoek'},
    {'group': 'Afrique Australe', 'label': 'Gaborone (UTC+2)',         'value': 'Africa/Gaborone'},
    {'group': 'Afrique Australe', 'label': 'Maseru (UTC+2)',           'value': 'Africa/Maseru'},
    {'group': 'Afrique Australe', 'label': 'Mbabane (UTC+2)',          'value': 'Africa/Mbabane'},
    // ── Îles ─────────────────────────────────────────────────────
    {'group': 'Îles', 'label': 'Cap-Vert (UTC-1)',                     'value': 'Atlantic/Cape_Verde'},
    {'group': 'Îles', 'label': 'Comores (UTC+3)',                      'value': 'Indian/Comoro'},
    {'group': 'Îles', 'label': 'Sainte-Hélène (UTC+0)',               'value': 'Atlantic/St_Helena'},
  ];

  /// Label affiché pour une valeur IANA donnée.
  static String labelFor(String value) {
    return all.firstWhere(
      (e) => e['value'] == value,
      orElse: () => {'label': value},
    )['label']!;
  }
}
