import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient({String? baseUrl})
      : baseUrl = baseUrl ??
            const String.fromEnvironment(
              'API_BASE',
              defaultValue: 'http://10.0.2.2:3000',
            );

  final String baseUrl;

  Future<List<Map<String, dynamic>>> fetchReports() async {
    final response = await http.get(Uri.parse('$baseUrl/api/reports'));
    final body = _decode(response);
    if (response.statusCode != 200) throw ApiException(body['error'] as String? ?? 'Não foi possível carregar as ocorrências.');
    return (body['reports'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> submitReport(Map<String, dynamic> report) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/reports'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(report),
    );
    final body = _decode(response);
    if (response.statusCode != 201) throw ApiException(body['error'] as String? ?? 'Não foi possível enviar o reporte.');
    return body;
  }

  Map<String, dynamic> _decode(http.Response response) {
    try {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }
}

class ApiException implements Exception {
  ApiException(this.message);

  final String message;
}
