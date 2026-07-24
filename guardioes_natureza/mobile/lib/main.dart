import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import 'api_client.dart';

void main() => runApp(const GuardioesApp());

class GuardioesApp extends StatelessWidget {
  const GuardioesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Guardiões da Natureza',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1B4332)),
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiClient _api = ApiClient();
  final ImagePicker _picker = ImagePicker();
  final _locationController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _category = 'lixo';
  XFile? _photo;
  Position? _position;
  bool _sending = false;
  bool _loadingReports = false;
  List<Map<String, dynamic>> _reports = [];
  int _currentTab = 0;

  @override
  void initState() {
    super.initState();
    _loadReports();
  }

  @override
  void dispose() {
    _locationController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadReports() async {
    setState(() => _loadingReports = true);
    try {
      final reports = await _api.fetchReports();
      if (mounted) setState(() => _reports = reports);
    } on ApiException catch (error) {
      _show(error.message);
    } catch (_) {
      _show('Sem ligação ao servidor.');
    } finally {
      if (mounted) setState(() => _loadingReports = false);
    }
  }

  Future<void> _getLocation() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      _show('Ative os serviços de localização.');
      return;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      _show('É necessária permissão de localização para enviar a ocorrência.');
      return;
    }
    try {
      final position = await Geolocator.getCurrentPosition();
      if (mounted) setState(() => _position = position);
    } catch (_) {
      _show('Não foi possível obter a localização atual.');
    }
  }

  Future<void> _takePhoto() async {
    try {
      final photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 75, maxWidth: 1600);
      if (photo != null && mounted) setState(() => _photo = photo);
    } catch (_) {
      _show('Não foi possível abrir a câmara.');
    }
  }

  Future<void> _submit() async {
    if (_position == null || _photo == null || _locationController.text.trim().isEmpty || _descriptionController.text.trim().isEmpty) {
      _show('Preencha o local, a descrição, a localização GPS e a fotografia.');
      return;
    }
    setState(() => _sending = true);
    try {
      final bytes = await _photo!.readAsBytes();
      final result = await _api.submitReport({
        'userId': 1,
        'category': _category,
        'location': _locationController.text.trim(),
        'description': _descriptionController.text.trim(),
        'latitude': _position!.latitude,
        'longitude': _position!.longitude,
        'accuracy': _position!.accuracy,
        'photoDataUrl': 'data:image/jpeg;base64,${base64Encode(bytes)}',
      });
      if (!mounted) return;
      _show('Reporte encaminhado para ${result['encaminhadoPara']}.');
      setState(() {
        _locationController.clear();
        _descriptionController.clear();
        _position = null;
        _photo = null;
        _currentTab = 1;
      });
      await _loadReports();
    } on ApiException catch (error) {
      _show(error.message);
    } catch (_) {
      _show('Não foi possível enviar o reporte.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _show(String message) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Guardiões da Natureza')),
      body: _currentTab == 0 ? _buildReportForm() : _buildReports(),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentTab,
        onDestinationSelected: (index) => setState(() => _currentTab = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.add_a_photo_outlined), selectedIcon: Icon(Icons.add_a_photo), label: 'Reportar'),
          NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map), label: 'Ocorrências'),
        ],
      ),
    );
  }

  Widget _buildReportForm() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        DropdownButtonFormField<String>(
          value: _category,
          decoration: const InputDecoration(labelText: 'Tipo de ocorrência', border: OutlineInputBorder()),
          items: const [
            DropdownMenuItem(value: 'lixo', child: Text('Lixo')),
            DropdownMenuItem(value: 'desmatamento', child: Text('Desmatamento')),
            DropdownMenuItem(value: 'incendio', child: Text('Incêndio')),
          ],
          onChanged: (value) => setState(() => _category = value ?? _category),
        ),
        const SizedBox(height: 12),
        TextField(controller: _locationController, decoration: const InputDecoration(labelText: 'Referência do local', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        TextField(controller: _descriptionController, maxLines: 4, decoration: const InputDecoration(labelText: 'Descrição', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _getLocation,
          icon: const Icon(Icons.my_location),
          label: Text(_position == null ? 'Obter localização GPS' : 'GPS: ${_position!.latitude.toStringAsFixed(5)}, ${_position!.longitude.toStringAsFixed(5)}'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _takePhoto,
          icon: const Icon(Icons.camera_alt),
          label: Text(_photo == null ? 'Tirar fotografia' : 'Fotografia selecionada: ${_photo!.name}'),
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _sending ? null : _submit,
          child: Text(_sending ? 'A enviar...' : 'Enviar ocorrência'),
        ),
      ],
    );
  }

  Widget _buildReports() {
    if (_loadingReports) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _loadReports,
      child: _reports.isEmpty
          ? ListView(children: const [SizedBox(height: 180), Center(child: Text('Ainda não existem ocorrências.'))])
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _reports.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, index) {
                final report = _reports[index];
                return Card(
                  child: ListTile(
                    leading: Icon(report['type'] == 'incendio' ? Icons.local_fire_department : Icons.report),
                    title: Text(report['location'] as String? ?? 'Ocorrência'),
                    subtitle: Text('${report['type']} · ${report['authorityName'] ?? 'Por encaminhar'}'),
                    trailing: Text(report['status'] as String? ?? ''),
                  ),
                );
              },
            ),
    );
  }
}
