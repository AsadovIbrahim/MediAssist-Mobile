import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LanguageCode = 'az' | 'en' | 'ru';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'az', label: 'Azərbaycan dili', flag: '🇦🇿' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский язык', flag: '🇷🇺' },
];

const STORAGE_KEY = 'mediassist.settings.language_code';

export const TRANSLATIONS = {
  az: {
    // Tabs
    'tab.home': 'Ana səhifə',
    'tab.documents': 'Sənədlər',
    'tab.search': 'Axtarış',
    'tab.profile': 'Profil',

    // Home
    'home.greeting': 'Salam',
    'home.patientList': 'Pasiyentlərin siyahısı',
    'home.searchPlaceholder': 'Pasiyent adı və ya telefon...',
    'home.newPatient': 'Yeni pasiyent',
    'home.noPatients': 'Pasiyent yoxdur',
    'home.noPatientsDesc': 'Yeni pasiyent əlavə edərək tibbi qeydləri idarə edin.',
    'home.ageSuffix': 'yaş',
    'home.deleteConfirmTitle': 'Pasiyent silinsin?',

    // Documents
    'documents.title': 'Sənədlər',
    'documents.searchPlaceholder': 'Fayl, sənəd və ya pasiyent axtar...',
    'documents.emptyTitle': 'Sənəd tapılmadı',
    'documents.emptyDesc': 'Şikayət, müayinə, diaqnoz və müalicələrə əlavə edilən bütün fayllar burada görünəcək.',

    // Search
    'search.title': 'Axtarış',
    'search.placeholder': 'Şikayət, diaqnoz və ya müalicə axtar...',
    'search.emptyTitle': 'Nəticə tapılmadı',
    'search.emptyDesc': 'Axtarışınıza uyğun heç bir nəticə tapılmadı.',

    // Patient Dashboard
    'dashboard.complaints': 'Şikayətlər',
    'dashboard.complaintsDesc': 'Şikayətlər, müşahidələr',
    'dashboard.examinations': 'Müayinələr',
    'dashboard.examinationsDesc': 'Laboratoriya, analizlər və sənədlər',
    'dashboard.diagnoses': 'Diaqnoz',
    'dashboard.diagnosesDesc': 'Diaqnoz sənədləri',
    'dashboard.treatments': 'Müalicə',
    'dashboard.treatmentsDesc': 'Müalicə planları, reseptlər',
    'dashboard.ai': 'AI Köməkçi',
    'dashboard.aiDesc': 'Ağıllı tibbi təhlil və xülasə',
    'dashboard.calendar': 'Təqvim',
    'dashboard.calendarDesc': 'Görüşlər, xatırlatmalar',

    // Profile Screen
    'profile.title': 'Profil',
    'profile.headerSubtitle': 'Həkim hesabı və tətbiq tənzimləmələri',
    'profile.roleBadge': 'Həkim • MediAssist',
    'profile.defaultDoctor': 'Həkim',
    'profile.patients': 'Pasiyentlər',
    'profile.appointments': 'Görüşlər',
    'profile.records': 'Qeydlər',
    'profile.settings': 'TƏNZİMLƏMƏLƏR',
    'profile.notifications': 'Görüş bildirişləri',
    'profile.notificationsDesc': 'Təqvim qəbulları üçün xatırlatmalar',
    'profile.darkMode': 'Qaranlıq rejim',
    'profile.darkModeDesc': 'Gözləri qoruyan qaranlıq interfeys',
    'profile.changePassword': 'Şifrəni dəyiş',
    'profile.changePasswordDesc': 'Hesabın təhlükəsizlik şifrəsi',
    'profile.language': 'Tətbiqin dili',
    'profile.supportSection': 'DƏSTƏK VƏ MƏLUMAT',
    'profile.contactSupport': 'Dəstək xidməti ilə əlaqə',
    'profile.contactSupportDesc': 'Suallarınız və təklifləriniz üçün',
    'profile.privacy': 'Məxfilik və təhlükəsizlik',
    'profile.privacyDesc': 'Məlumatların qorunması qaydaları',
    'profile.logout': 'Çıxış et',
    'profile.logoutConfirm': 'Hesabdan çıxmaq istədiyinizə əminsiniz?',

    // Support Modal
    'support.title': 'Yardım və Dəstək',
    'support.desc': 'Hər hansı sualınız, texniki probleminiz və ya təklifiniz varsa, bizimlə birbaşa əlaqə saxlaya bilərsiniz.',
    'support.whatsapp': 'WhatsApp Dəstək Xətti',
    'support.email': 'Email Dəstək',
    'support.hotline': 'Qaynar Xətt',

    // Privacy Modal
    'privacy.title': 'Məxfilik və Təhlükəsizlik',
    'privacy.item1Title': 'Tibbi Məlumatların Məxfiliyi',
    'privacy.item1Desc': 'Bütün pasiyent qeydləri, reseptlər və analizlər yüksək səviyyəli təhlükəsizlik protokolları ilə şifrələnir və üçüncü şəxslərə ötürülmür.',
    'privacy.item2Title': 'Həkim Məsuliyyəti',
    'privacy.item2Desc': 'Yalnız qeydiyyatdan keçmiş və təsdiqlənmiş həkim öz kabinetindəki pasiyentlərin tibbi tarixçəsinə baxa və dəyişiklik edə bilər.',
    'privacy.item3Title': 'Təhlükəsiz Giriş',
    'privacy.item3Desc': 'Hesaba giriş OTP təsdiqləmə və JWT token təhlükəsizlik texnologiyası ilə qorunur.',
    'privacy.gotIt': 'Anladım',

    // Password Modal
    'password.modalTitle': 'Şifrəni dəyiş',
    'password.old': 'Köhnə şifrə',
    'password.oldPlaceholder': 'Mövcud şifrənizi daxil edin',
    'password.new': 'Yeni şifrə',
    'password.newPlaceholder': 'Yeni şifrə (ən azı 6 simvol)',
    'password.confirm': 'Yeni şifrənin təkrarı',
    'password.confirmPlaceholder': 'Yeni şifrəni təkrar daxil edin',
    'password.submit': 'Şifrəni yenilə',
    'password.updating': 'Yenilənir...',
    'password.successTitle': 'Uğurlu!',
    'password.successMsg': 'Şifrəniz uğurla yeniləndi.',
    'password.errFill': 'Zəhmət olmasa bütün sahələri doldurun.',
    'password.errLength': 'Yeni şifrə ən azı 6 simvoldan ibarət olmalıdır.',
    'password.errMismatch': 'Yeni şifrələr bir-biri ilə uyğun gəlmir.',
    'password.errSame': 'Yeni şifrə köhnə şifrə ilə eyni ola bilməz.',

    // Language Modal
    'language.modalTitle': 'Tətbiqin dili',
    'language.selectPrompt': 'İstədiyiniz dili seçin',

    // Calendar
    'calendar.title': 'Təqvim',
    'calendar.today': 'Bu gün',
    'calendar.noAppointments': 'Bu tarixdə görüş yoxdur',
    'calendar.noAppointmentsDesc': 'Yeni görüş və ya xatırlatma əlavə edə bilərsiniz.',

    // Common
    'common.add': 'Əlavə et',
    'common.close': 'Bağla',
    'common.cancel': 'Ləğv et',
    'common.delete': 'Sil',
    'common.save': 'Yadda saxla',
    'common.edit': 'Düzəliş et',
    'common.error': 'Xəta',
    'common.attention': 'Diqqət',
    'common.retry': 'Yenidən cəhd et',
    'common.selected': 'seçildi',
    'common.selectAll': 'Hamısı',
    'common.deselectAll': 'Ləğv et',

    // Dashboard Extra
    'dashboard.noPatient': 'Pasiyent seçilməyib',
    'dashboard.noPatientDesc': 'Tibbi qeydləri, şikayətləri və müayinələri idarə etmək üçün pasiyenti seçin.',
    'dashboard.backToList': 'Pasiyentlər siyahısına qayıt',

    // Records & Detail
    'record.complaints': 'Şikayətlər',
    'record.complaint': 'Şikayət',
    'record.newComplaint': 'Yeni şikayət',
    'record.editComplaint': 'Şikayəti redaktə et',
    'record.searchComplaint': 'Şikayət axtar...',
    'record.descComplaint': 'Şikayətin təsviri',
    'record.descComplaintPlh': 'Şikayəti ətraflı təsvir edin...',
    'record.emptyComplaint': 'Hələ şikayət əlavə edilməyib.',

    'record.examinations': 'Müayinələr',
    'record.examination': 'Müayinə',
    'record.newExamination': 'Yeni müayinə',
    'record.editExamination': 'Müayinəni redaktə et',
    'record.searchExamination': 'Müayinə və ya analiz axtar...',
    'record.descExamination': 'Müayinə təsviri / Nəticə',
    'record.descExaminationPlh': 'Müayinə nəticələri, laboratoriya göstəriciləri...',
    'record.emptyExamination': 'Hələ müayinə və ya analiz sənədi əlavə edilməyib.',

    'record.diagnoses': 'Diaqnoz',
    'record.diagnosis': 'Diaqnoz',
    'record.newDiagnosis': 'Yeni diaqnoz',
    'record.editDiagnosis': 'Diaqnozu redaktə et',
    'record.searchDiagnosis': 'Diaqnoz axtar...',
    'record.descDiagnosis': 'Təsvir',
    'record.descDiagnosisPlh': 'Diaqnoz haqqında qeydlər...',
    'record.emptyDiagnosis': 'Hələ diaqnoz sənədi əlavə edilməyib.',

    'record.treatments': 'Müalicə',
    'record.treatment': 'Müalicə',
    'record.newTreatment': 'Yeni müalicə',
    'record.editTreatment': 'Müalicəni redaktə et',
    'record.searchTreatment': 'Müalicə axtar...',
    'record.descTreatment': 'Təsvir',
    'record.descTreatmentPlh': 'Dərmanlar, dozalar, tövsiyələr...',
    'record.emptyTreatment': 'Hələ müalicə planı və ya resept əlavə edilməyib.',
    'record.voiceSuffix': '(Səs qeydi)',
    'record.fileSuffix': '(Fayllı)',
    'record.recordSuffix': 'qeydi',

    'record.filterAll': 'Hamısı',
    'record.filterText': 'Yazılı',
    'record.filterImage': 'Şəkil',
    'record.filterVoice': 'Səs',
    'record.filterDocument': 'Sənəd',
    'record.filterDocuments': 'Sənədlər',
    'record.filterImages': 'Şəkillər',
    'record.filterNotes': 'Qeydlər',
    'record.filterNote': 'Qeyd',
    'record.filterPrescription': 'Resept',
    'record.filterPrescriptions': 'Reseptlər',
    'record.filterPlan': 'Plan',
    'record.filterPlans': 'Planlar',

    'record.images': 'Şəkillər',
    'record.voiceNotes': 'Səs qeydləri',
    'record.docs': 'Sənədlər',
    'record.addFile': 'Fayl əlavə et',
    'record.deleteConfirmTitle': 'Silinsin?',
    'record.deleteFileTitle': 'Fayl silinsin?',

    // Forms
    'form.date': 'Tarix',
    'form.addFiles': 'Fayllar əlavə et',
    'form.existingFiles': 'Mövcud fayllar',
    'form.newFiles': 'Yeni əlavə edilən fayllar',
    'form.addPhoto': 'Şəkil əlavə et',
    'form.camera': 'Kamera',
    'form.voiceNote': 'Səs qeydi',
    'form.selectDoc': 'Sənəd seç',
    'form.needPatient': 'Əvvəlcə pasiyent seçin və ya yaradın.',
    'form.needDescOrFile': 'Zəhmət olmasa təsvir yazın və ya fayl əlavə edin.',
    'form.partiallySaved': 'Qismən saxlanıldı',

    // Appointment Form
    'appointment.newAppointment': 'Yeni görüş',
    'appointment.editAppointment': 'Görüşə düzəliş et',
    'appointment.doctorVisit': 'Həkim müayinəsi',
    'appointment.labTest': 'Analiz / Lab',
    'appointment.other': 'Digər',
    'appointment.title': 'Başlıq',
    'appointment.titlePlh': 'Məs: Həkim müayinəsi, Qan analizi',
    'appointment.location': 'İxtisas / Klinika',
    'appointment.locationPlh': 'Məs: Nevroloq, Lab klinika',
    'appointment.time': 'Saat',
    'appointment.notes': 'Qeyd',
    'appointment.notesPlh': 'Əlavə qeydlər, xatırlatma...',
    'appointment.needTitle': 'Başlıq daxil edin.',
    'appointment.invalidTime': 'Saatı SS:DD formatında daxil edin (məs: 10:00).',

    // Offline
    'offline.banner': 'Oflayn rejim — məlumatlar yerli yaddaşdan göstərilir',
    'offline.pending': 'dəyişiklik gözləyir',
    'offline.syncNow': 'Sinxronlaşdır',
    'offline.syncing': 'Sinxronlaşdırılır...',
    'offline.savedLocally': 'Yaddaşa saxlanıldı. İnternet bərpa olunan kimi serverə yüklənəcək.',

    // Patient Form
    'patient.newPatient': 'Yeni pasiyent',
    'patient.editPatient': 'Pasiyenti redaktə et',
    'patient.photoTitle': 'Pasiyent şəkli',
    'patient.photoPrompt': 'Şəkli necə əlavə etmək istəyirsiniz?',
    'patient.takePhoto': 'Kamera ilə çək',
    'patient.chooseGallery': 'Qalereyadan seç',
    'patient.gallery': 'Qalereya',
    'patient.firstName': 'Ad *',
    'patient.firstNamePlh': 'Pasiyentin adını daxil edin',
    'patient.lastName': 'Soyad *',
    'patient.lastNamePlh': 'Pasiyentin soyadını daxil edin',
    'patient.phone': 'Telefon *',
    'patient.birthYear': 'Doğum ili',
    'patient.birthYearPlh': 'Məsələn: 1965',
    'patient.note': 'Qeyd',
    'patient.notePlh': 'Əlavə məlumat, allergiyalar...',
    'patient.requiredError': 'Ad, soyad və telefon nömrəsini daxil edin.',

    // DatePicker & Recorder
    'datePicker.selectDate': 'Tarix seçin',
    'datePicker.select': 'Seç',
    'recorder.title': 'Səs qeydi',
    'recorder.recording': 'Yazılır...',
    'recorder.tapToStart': 'Başlamaq üçün düyməyə toxunun',

    // AI Screen
    'ai.screenTitle': 'AI köməkçi və xülasə',
    'ai.cardTitle': 'AI Tibbi Xülasə',
    'ai.notSelected': 'Pasiyent seçilməyib',
    'ai.prompt1': 'Son şikayətləri xülasə et',
    'ai.prompt2': 'Aktiv müalicə planı nədir?',
    'ai.prompt3': 'Son diaqnoz nəticələri',
    'ai.prompt4': 'Ümumi tibbi vəziyyət',
    'ai.settings': 'AI Tənzimləmələri',
    'ai.thinking': 'AI təhlil edir...',
    'ai.clearChat': 'Söhbəti təmizlə',
    'ai.clearChatConfirm': 'Bütün söhbət tarixçəsi təmizlənsin?',
    'ai.inputPlh': 'AI-dan soruşun...',
    'ai.recentComplaints': 'Son şikayətlər',
    'ai.recentDiagnoses': 'Son diaqnozlar',
    'ai.recentTreatments': 'Son müalicələr',
    'ai.complaints': 'şikayət',
    'ai.diagnoses': 'diaqnoz',
    'ai.treatments': 'müalicə',
    'ai.appointments': 'görüş',
    'ai.summaryPrefix': 'üzrə tibbi xülasə:',
    'ai.noRecords': 'Qeyd yoxdur',
  },
  en: {
    // Tabs
    'tab.home': 'Home',
    'tab.documents': 'Documents',
    'tab.search': 'Search',
    'tab.profile': 'Profile',

    // Home
    'home.greeting': 'Hello',
    'home.patientList': 'Patients list',
    'home.searchPlaceholder': 'Patient name or phone...',
    'home.newPatient': 'New patient',
    'home.noPatients': 'No patients',
    'home.noPatientsDesc': 'Add a new patient to manage medical records.',
    'home.ageSuffix': 'years old',
    'home.deleteConfirmTitle': 'Delete patient?',

    // Documents
    'documents.title': 'Documents',
    'documents.searchPlaceholder': 'Search file, document, or patient...',
    'documents.emptyTitle': 'No documents found',
    'documents.emptyDesc': 'All files added to complaints, examinations, diagnoses, and treatments will appear here.',

    // Search
    'search.title': 'Search',
    'search.placeholder': 'Search complaint, diagnosis, or treatment...',
    'search.emptyTitle': 'No results found',
    'search.emptyDesc': 'No records matched your search query.',

    // Patient Dashboard
    'dashboard.complaints': 'Complaints',
    'dashboard.complaintsDesc': 'Symptoms and complaints',
    'dashboard.examinations': 'Examinations',
    'dashboard.examinationsDesc': 'Lab tests and clinical files',
    'dashboard.diagnoses': 'Diagnosis',
    'dashboard.diagnosesDesc': 'Diagnosis and assessment documents',
    'dashboard.treatments': 'Treatment',
    'dashboard.treatmentsDesc': 'Treatment plans, prescriptions',
    'dashboard.ai': 'AI Assistant',
    'dashboard.aiDesc': 'Smart medical analysis & summary',
    'dashboard.calendar': 'Calendar',
    'dashboard.calendarDesc': 'Appointments and reminders',

    // Profile Screen
    'profile.title': 'Profile',
    'profile.headerSubtitle': 'Doctor account and app settings',
    'profile.roleBadge': 'Doctor • MediAssist',
    'profile.defaultDoctor': 'Doctor',
    'profile.patients': 'Patients',
    'profile.appointments': 'Appointments',
    'profile.records': 'Records',
    'profile.settings': 'SETTINGS',
    'profile.notifications': 'Appointment notifications',
    'profile.notificationsDesc': 'Reminders for calendar bookings',
    'profile.darkMode': 'Dark mode',
    'profile.darkModeDesc': 'Eye-friendly dark appearance',
    'profile.changePassword': 'Change password',
    'profile.changePasswordDesc': 'Account security password',
    'profile.language': 'App language',
    'profile.supportSection': 'SUPPORT & INFORMATION',
    'profile.contactSupport': 'Contact support',
    'profile.contactSupportDesc': 'For questions and inquiries',
    'profile.privacy': 'Privacy & Security',
    'profile.privacyDesc': 'Data protection and policies',
    'profile.logout': 'Sign out',
    'profile.logoutConfirm': 'Are you sure you want to sign out?',

    // Support Modal
    'support.title': 'Help & Support',
    'support.desc': 'If you have any questions, technical issues, or suggestions, feel free to contact us directly.',
    'support.whatsapp': 'WhatsApp Support Line',
    'support.email': 'Email Support',
    'support.hotline': 'Hotline',

    // Privacy Modal
    'privacy.title': 'Privacy & Security',
    'privacy.item1Title': 'Medical Data Privacy',
    'privacy.item1Desc': 'All patient records, prescriptions, and test results are encrypted using enterprise-grade security protocols and are never shared with third parties.',
    'privacy.item2Title': 'Doctor Responsibility',
    'privacy.item2Desc': 'Only registered and verified medical professionals can access and manage their assigned patients medical history.',
    'privacy.item3Title': 'Secure Authentication',
    'privacy.item3Desc': 'Account access is protected with OTP verification and JWT security architecture.',
    'privacy.gotIt': 'Got it',

    // Password Modal
    'password.modalTitle': 'Change Password',
    'password.old': 'Current password',
    'password.oldPlaceholder': 'Enter your current password',
    'password.new': 'New password',
    'password.newPlaceholder': 'New password (min. 6 characters)',
    'password.confirm': 'Confirm new password',
    'password.confirmPlaceholder': 'Re-enter your new password',
    'password.submit': 'Update Password',
    'password.updating': 'Updating...',
    'password.successTitle': 'Success!',
    'password.successMsg': 'Your password has been updated successfully.',
    'password.errFill': 'Please fill in all fields.',
    'password.errLength': 'New password must be at least 6 characters.',
    'password.errMismatch': 'New passwords do not match.',
    'password.errSame': 'New password cannot be the same as current password.',

    // Language Modal
    'language.modalTitle': 'App Language',
    'language.selectPrompt': 'Choose your preferred language',

    // Calendar
    'calendar.title': 'Calendar',
    'calendar.today': 'Today',
    'calendar.noAppointments': 'No appointments on this date',
    'calendar.noAppointmentsDesc': 'You can add a new appointment or reminder.',

    // Common
    'common.add': 'Add',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.edit': 'Edit',
    'common.error': 'Error',
    'common.attention': 'Notice',
    'common.retry': 'Try again',
    'common.selected': 'selected',
    'common.selectAll': 'Select all',
    'common.deselectAll': 'Deselect',

    // Dashboard Extra
    'dashboard.noPatient': 'No patient selected',
    'dashboard.noPatientDesc': 'Select a patient to manage medical records, complaints, and examinations.',
    'dashboard.backToList': 'Back to patient list',

    // Records & Detail
    'record.complaints': 'Complaints',
    'record.complaint': 'Complaint',
    'record.newComplaint': 'New complaint',
    'record.editComplaint': 'Edit complaint',
    'record.searchComplaint': 'Search complaints...',
    'record.descComplaint': 'Description',
    'record.descComplaintPlh': 'Describe the symptoms in detail...',
    'record.emptyComplaint': 'No complaints added yet.',

    'record.examinations': 'Examinations',
    'record.examination': 'Examination',
    'record.newExamination': 'New examination',
    'record.editExamination': 'Edit examination',
    'record.searchExamination': 'Search examination or lab...',
    'record.descExamination': 'Description / Results',
    'record.descExaminationPlh': 'Test results, lab findings...',
    'record.emptyExamination': 'No examination or test documents added yet.',

    'record.diagnoses': 'Diagnosis',
    'record.diagnosis': 'Diagnosis',
    'record.newDiagnosis': 'New diagnosis',
    'record.editDiagnosis': 'Edit diagnosis',
    'record.searchDiagnosis': 'Search diagnosis...',
    'record.descDiagnosis': 'Description',
    'record.descDiagnosisPlh': 'Notes about diagnosis...',
    'record.emptyDiagnosis': 'No diagnosis documents added yet.',

    'record.treatments': 'Treatment',
    'record.treatment': 'Treatment',
    'record.newTreatment': 'New treatment',
    'record.editTreatment': 'Edit treatment',
    'record.searchTreatment': 'Search treatments...',
    'record.descTreatment': 'Description',
    'record.descTreatmentPlh': 'Medications, dosages, advice...',
    'record.emptyTreatment': 'No treatment plans or prescriptions added yet.',
    'record.voiceSuffix': '(Voice note)',
    'record.fileSuffix': '(With files)',
    'record.recordSuffix': 'record',

    'record.filterAll': 'All',
    'record.filterText': 'Text',
    'record.filterImage': 'Photo',
    'record.filterVoice': 'Voice',
    'record.filterDocument': 'Document',
    'record.filterDocuments': 'Documents',
    'record.filterImages': 'Photos',
    'record.filterNotes': 'Notes',
    'record.filterNote': 'Note',
    'record.filterPrescription': 'Prescription',
    'record.filterPrescriptions': 'Prescriptions',
    'record.filterPlan': 'Plan',
    'record.filterPlans': 'Plans',

    'record.images': 'Photos',
    'record.voiceNotes': 'Voice recordings',
    'record.docs': 'Documents',
    'record.addFile': 'Add file',
    'record.deleteConfirmTitle': 'Delete record?',
    'record.deleteFileTitle': 'Delete file?',

    // Forms
    'form.date': 'Date',
    'form.addFiles': 'Add files',
    'form.existingFiles': 'Existing files',
    'form.newFiles': 'Newly added files',
    'form.addPhoto': 'Add photo',
    'form.camera': 'Camera',
    'form.voiceNote': 'Voice note',
    'form.selectDoc': 'Select file',
    'form.needPatient': 'Please select or create a patient first.',
    'form.needDescOrFile': 'Please enter a description or attach a file.',
    'form.partiallySaved': 'Partially saved',

    // Appointment Form
    'appointment.newAppointment': 'New appointment',
    'appointment.editAppointment': 'Edit appointment',
    'appointment.doctorVisit': 'Doctor visit',
    'appointment.labTest': 'Lab test',
    'appointment.other': 'Other',
    'appointment.title': 'Title',
    'appointment.titlePlh': 'e.g. Doctor visit, Blood test',
    'appointment.location': 'Specialty / Clinic',
    'appointment.locationPlh': 'e.g. Neurologist, City Clinic',
    'appointment.time': 'Time',
    'appointment.notes': 'Note',
    'appointment.notesPlh': 'Additional notes, reminders...',
    'appointment.needTitle': 'Please enter a title.',
    'appointment.invalidTime': 'Enter time in HH:MM format (e.g. 10:00).',

    // Offline
    'offline.banner': 'Offline mode — showing local cached data',
    'offline.pending': 'pending changes',
    'offline.syncNow': 'Sync now',
    'offline.syncing': 'Syncing...',
    'offline.savedLocally': 'Saved to storage. Will sync to server when connection is restored.',

    // Patient Form
    'patient.newPatient': 'New patient',
    'patient.editPatient': 'Edit patient',
    'patient.photoTitle': 'Patient photo',
    'patient.photoPrompt': 'How would you like to add the photo?',
    'patient.takePhoto': 'Take photo',
    'patient.chooseGallery': 'Choose from gallery',
    'patient.gallery': 'Gallery',
    'patient.firstName': 'First name *',
    'patient.firstNamePlh': 'Enter patient first name',
    'patient.lastName': 'Last name *',
    'patient.lastNamePlh': 'Enter patient last name',
    'patient.phone': 'Phone *',
    'patient.birthYear': 'Birth year',
    'patient.birthYearPlh': 'e.g. 1965',
    'patient.note': 'Note',
    'patient.notePlh': 'Additional notes, allergies...',
    'patient.requiredError': 'First name, last name, and phone are required.',

    // DatePicker & Recorder
    'datePicker.selectDate': 'Select date',
    'datePicker.select': 'Select',
    'recorder.title': 'Voice recording',
    'recorder.recording': 'Recording...',
    'recorder.tapToStart': 'Tap button to start recording',

    // AI Screen
    'ai.screenTitle': 'AI Assistant & Summary',
    'ai.cardTitle': 'AI Medical Summary',
    'ai.notSelected': 'No patient selected',
    'ai.prompt1': 'Summarize recent complaints',
    'ai.prompt2': 'What is the active treatment plan?',
    'ai.prompt3': 'Recent diagnosis results',
    'ai.prompt4': 'General medical condition',
    'ai.settings': 'AI Settings',
    'ai.thinking': 'AI is analyzing...',
    'ai.clearChat': 'Clear chat',
    'ai.clearChatConfirm': 'Clear all chat history?',
    'ai.inputPlh': 'Ask AI...',
    'ai.recentComplaints': 'Recent complaints',
    'ai.recentDiagnoses': 'Recent diagnoses',
    'ai.recentTreatments': 'Recent treatments',
    'ai.complaints': 'complaints',
    'ai.diagnoses': 'diagnoses',
    'ai.treatments': 'treatments',
    'ai.appointments': 'appointments',
    'ai.summaryPrefix': 'medical summary:',
    'ai.noRecords': 'No records',
  },
  ru: {
    // Tabs
    'tab.home': 'Главная',
    'tab.documents': 'Документы',
    'tab.search': 'Поиск',
    'tab.profile': 'Профиль',

    // Home
    'home.greeting': 'Здравствуйте',
    'home.patientList': 'Список пациентов',
    'home.searchPlaceholder': 'Имя пациента или телефон...',
    'home.newPatient': 'Новый пациент',
    'home.noPatients': 'Пациентов нет',
    'home.noPatientsDesc': 'Добавьте нового пациента для ведения медицинской карты.',
    'home.ageSuffix': 'лет',
    'home.deleteConfirmTitle': 'Удалить пациента?',

    // Documents
    'documents.title': 'Документы',
    'documents.searchPlaceholder': 'Поиск файла, документа или пациента...',
    'documents.emptyTitle': 'Документы не найдены',
    'documents.emptyDesc': 'Все файлы, добавленные к жалобам, осмотрам, диагнозам и лечению, появятся здесь.',

    // Search
    'search.title': 'Поиск',
    'search.placeholder': 'Поиск жалобы, диагноза или лечения...',
    'search.emptyTitle': 'Ничего не найдено',
    'search.emptyDesc': 'По вашему запросу ничего не найдено.',

    // Patient Dashboard
    'dashboard.complaints': 'Жалобы',
    'dashboard.complaintsDesc': 'Жалобы, симптомы, наблюдения',
    'dashboard.examinations': 'Обследования',
    'dashboard.examinationsDesc': 'Лабораторные анализы и файлы',
    'dashboard.diagnoses': 'Диагноз',
    'dashboard.diagnosesDesc': 'Документы диагнозов',
    'dashboard.treatments': 'Лечение',
    'dashboard.treatmentsDesc': 'Планы лечения, рецепты',
    'dashboard.ai': 'ИИ Помощник',
    'dashboard.aiDesc': 'Умный медицинский анализ и резюме',
    'dashboard.calendar': 'Календарь',
    'dashboard.calendarDesc': 'Приемы и напоминания',

    // Profile Screen
    'profile.title': 'Профиль',
    'profile.headerSubtitle': 'Аккаунт врача и настройки приложения',
    'profile.roleBadge': 'Врач • MediAssist',
    'profile.defaultDoctor': 'Врач',
    'profile.patients': 'Пациенты',
    'profile.appointments': 'Встречи',
    'profile.records': 'Записи',
    'profile.settings': 'НАСТРОЙКИ',
    'profile.notifications': 'Уведомления о приемах',
    'profile.notificationsDesc': 'Напоминания о записях в календаре',
    'profile.darkMode': 'Тёмная тема',
    'profile.darkModeDesc': 'Комфортное тёмное оформление',
    'profile.changePassword': 'Сменить пароль',
    'profile.changePasswordDesc': 'Пароль безопасности аккаунта',
    'profile.language': 'Язык приложения',
    'profile.supportSection': 'ПОДДЕРЖКА И ИНФОРМАЦИЯ',
    'profile.contactSupport': 'Связаться с поддержкой',
    'profile.contactSupportDesc': 'Вопросы и предложения',
    'profile.privacy': 'Конфиденциальность и безопасность',
    'profile.privacyDesc': 'Политика защиты персональных данных',
    'profile.logout': 'Выйти из аккаунта',
    'profile.logoutConfirm': 'Вы уверены, что хотите выйти из аккаунта?',

    // Support Modal
    'support.title': 'Помощь и поддержка',
    'support.desc': 'Если у вас есть вопросы, технические проблемы или предложения, вы можете связаться с нами напрямую.',
    'support.whatsapp': 'Линия поддержки WhatsApp',
    'support.email': 'Поддержка по почте',
    'support.hotline': 'Горячая линия',

    // Privacy Modal
    'privacy.title': 'Конфиденциальность и безопасность',
    'privacy.item1Title': 'Конфиденциальность медицинских данных',
    'privacy.item1Desc': 'Все карты пациентов, рецепты и анализы зашифрованы по стандартам безопасности и не передаются третьим лицам.',
    'privacy.item2Title': 'Ответственность врача',
    'privacy.item2Desc': 'Только зарегистрированный и подтвержденный врач может просматривать и изменять историю болезни пациентов в своем кабинете.',
    'privacy.item3Title': 'Безопасный вход',
    'privacy.item3Desc': 'Доступ к аккаунту защищен OTP-подтверждением и технологиями безопасности JWT.',
    'privacy.gotIt': 'Понятно',

    // Password Modal
    'password.modalTitle': 'Сменить пароль',
    'password.old': 'Текущий пароль',
    'password.oldPlaceholder': 'Введите текущий пароль',
    'password.new': 'Новый пароль',
    'password.newPlaceholder': 'Новый пароль (мин. 6 символов)',
    'password.confirm': 'Повторите новый пароль',
    'password.confirmPlaceholder': 'Повторно введите новый пароль',
    'password.submit': 'Обновить пароль',
    'password.updating': 'Обновление...',
    'password.successTitle': 'Успешно!',
    'password.successMsg': 'Ваш пароль был успешно изменен.',
    'password.errFill': 'Пожалуйста, заполните все поля.',
    'password.errLength': 'Новый пароль должен содержать не менее 6 символов.',
    'password.errMismatch': 'Новые пароли не совпадают.',
    'password.errSame': 'Новый пароль не может совпадать со старым.',

    // Language Modal
    'language.modalTitle': 'Язык приложения',
    'language.selectPrompt': 'Выберите язык',

    // Calendar
    'calendar.title': 'Календарь',
    'calendar.today': 'Сегодня',
    'calendar.noAppointments': 'На эту дату встреч нет',
    'calendar.noAppointmentsDesc': 'Вы можете добавить новую встречу или напоминание.',

    // Common
    'common.add': 'Добавить',
    'common.close': 'Закрыть',
    'common.cancel': 'Отмена',
    'common.delete': 'Удалить',
    'common.save': 'Сохранить',
    'common.edit': 'Редактировать',
    'common.error': 'Ошибка',
    'common.attention': 'Внимание',
    'common.retry': 'Повторить',
    'common.selected': 'выбрано',
    'common.selectAll': 'Все',
    'common.deselectAll': 'Снять выбор',

    // Dashboard Extra
    'dashboard.noPatient': 'Пациент не выбран',
    'dashboard.noPatientDesc': 'Выберите пациента для управления медицинскими записями, жалобами и анализами.',
    'dashboard.backToList': 'Вернуться к списку пациентов',

    // Records & Detail
    'record.complaints': 'Жалобы',
    'record.complaint': 'Жалоба',
    'record.newComplaint': 'Новая жалоба',
    'record.editComplaint': 'Редактировать жалобу',
    'record.searchComplaint': 'Поиск жалобы...',
    'record.descComplaint': 'Описание жалобы',
    'record.descComplaintPlh': 'Опишите жалобы подробно...',
    'record.emptyComplaint': 'Жалобы пока не добавлены.',

    'record.examinations': 'Обследования',
    'record.examination': 'Обследование',
    'record.newExamination': 'Новое обследование',
    'record.editExamination': 'Редактировать обследование',
    'record.searchExamination': 'Поиск обследования или анализа...',
    'record.descExamination': 'Описание / Результаты',
    'record.descExaminationPlh': 'Результаты обследования, показатели...',
    'record.emptyExamination': 'Документы обследований пока не добавлены.',

    'record.diagnoses': 'Диагноз',
    'record.diagnosis': 'Диагноз',
    'record.newDiagnosis': 'Новый диагноз',
    'record.editDiagnosis': 'Редактировать диагноз',
    'record.searchDiagnosis': 'Поиск диагноза...',
    'record.descDiagnosis': 'Описание',
    'record.descDiagnosisPlh': 'Заметки о диагнозе...',
    'record.emptyDiagnosis': 'Документы диагноза пока не добавлены.',

    'record.treatments': 'Лечение',
    'record.treatment': 'Лечение',
    'record.newTreatment': 'Новое лечение',
    'record.editTreatment': 'Редактировать лечение',
    'record.searchTreatment': 'Поиск лечения...',
    'record.descTreatment': 'Описание',
    'record.descTreatmentPlh': 'Препараты, дозировки, рекомендации...',
    'record.emptyTreatment': 'Планы лечения или рецепты пока не добавлены.',
    'record.voiceSuffix': '(Голосовая запись)',
    'record.fileSuffix': '(С файлами)',
    'record.recordSuffix': 'запись',

    'record.filterAll': 'Все',
    'record.filterText': 'Текст',
    'record.filterImage': 'Фото',
    'record.filterVoice': 'Голос',
    'record.filterDocument': 'Документ',
    'record.filterDocuments': 'Документы',
    'record.filterImages': 'Фотографии',
    'record.filterNotes': 'Заметки',
    'record.filterNote': 'Заметка',
    'record.filterPrescription': 'Рецепт',
    'record.filterPrescriptions': 'Рецепты',
    'record.filterPlan': 'План',
    'record.filterPlans': 'Планы',

    'record.images': 'Фотографии',
    'record.voiceNotes': 'Голосовые записи',
    'record.docs': 'Документы',
    'record.addFile': 'Добавить файл',
    'record.deleteConfirmTitle': 'Удалить запись?',
    'record.deleteFileTitle': 'Удалить файл?',

    // Forms
    'form.date': 'Дата',
    'form.addFiles': 'Добавить файлы',
    'form.existingFiles': 'Текущие файлы',
    'form.newFiles': 'Новые файлы',
    'form.addPhoto': 'Добавить фото',
    'form.camera': 'Камера',
    'form.voiceNote': 'Голосовая запись',
    'form.selectDoc': 'Выбрать документ',
    'form.needPatient': 'Сначала выберите или создайте пациента.',
    'form.needDescOrFile': 'Пожалуйста, введите описание или прикрепите файл.',
    'form.partiallySaved': 'Частично сохранено',

    // Appointment Form
    'appointment.newAppointment': 'Новая встреча',
    'appointment.editAppointment': 'Редактировать встречу',
    'appointment.doctorVisit': 'Прием врача',
    'appointment.labTest': 'Анализ / Лаборатория',
    'appointment.other': 'Другое',
    'appointment.title': 'Название',
    'appointment.titlePlh': 'Напр: Прием врача, Анализ крови',
    'appointment.location': 'Специальность / Клиника',
    'appointment.locationPlh': 'Напр: Невролог, Городская клиника',
    'appointment.time': 'Время',
    'appointment.notes': 'Заметка',
    'appointment.notesPlh': 'Дополнительные заметки, напоминания...',
    'appointment.needTitle': 'Введите название.',
    'appointment.invalidTime': 'Введите время в формате ЧЧ:ММ (напр. 10:00).',

    // Offline
    'offline.banner': 'Офлайн режим — данные загружены из памяти телефона',
    'offline.pending': 'ожидает синхронизации',
    'offline.syncNow': 'Синхронизировать',
    'offline.syncing': 'Синхронизация...',
    'offline.savedLocally': 'Сохранено в памяти. Синхронизируется при появлении интернета.',

    // Patient Form
    'patient.newPatient': 'Новый пациент',
    'patient.editPatient': 'Редактировать пациента',
    'patient.photoTitle': 'Фото пациента',
    'patient.photoPrompt': 'Как вы хотите добавить фото?',
    'patient.takePhoto': 'Сделать фото',
    'patient.chooseGallery': 'Выбрать из галереи',
    'patient.gallery': 'Галерея',
    'patient.firstName': 'Имя *',
    'patient.firstNamePlh': 'Введите имя пациента',
    'patient.lastName': 'Фамилия *',
    'patient.lastNamePlh': 'Введите фамилию пациента',
    'patient.phone': 'Телефон *',
    'patient.birthYear': 'Год рождения',
    'patient.birthYearPlh': 'Например: 1965',
    'patient.note': 'Заметка',
    'patient.notePlh': 'Дополнительно, аллергии...',
    'patient.requiredError': 'Введите имя, фамилию и номер телефона.',

    // DatePicker & Recorder
    'datePicker.selectDate': 'Выберите дату',
    'datePicker.select': 'Выбрать',
    'recorder.title': 'Голосовая запись',
    'recorder.recording': 'Идет запись...',
    'recorder.tapToStart': 'Нажмите кнопку для начала записи',

    // AI Screen
    'ai.screenTitle': 'ИИ Ассистент и резюме',
    'ai.cardTitle': 'ИИ Медицинское резюме',
    'ai.notSelected': 'Пациент не выбран',
    'ai.prompt1': 'Кратко о последних жалобах',
    'ai.prompt2': 'Какой активный план лечения?',
    'ai.prompt3': 'Результаты последних анализов',
    'ai.prompt4': 'Общее состояние здоровья',
    'ai.settings': 'Настройки ИИ',
    'ai.thinking': 'ИИ анализирует...',
    'ai.clearChat': 'Очистить чат',
    'ai.clearChatConfirm': 'Очистить всю историю чата?',
    'ai.inputPlh': 'Спросите у ИИ...',
    'ai.recentComplaints': 'Последние жалобы',
    'ai.recentDiagnoses': 'Последние диагнозы',
    'ai.recentTreatments': 'Последнее лечение',
    'ai.complaints': 'жалоб',
    'ai.diagnoses': 'диагнозов',
    'ai.treatments': 'лечений',
    'ai.appointments': 'приемов',
    'ai.summaryPrefix': 'медицинское резюме:',
    'ai.noRecords': 'Записей нет',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.az;

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: TranslationKey) => string;
  currentLanguageOption: LanguageOption;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('az');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && (saved === 'az' || saved === 'en' || saved === 'ru')) {
          setLanguageState(saved);
        } else if (saved) {
          if (saved.toLowerCase().includes('az')) setLanguageState('az');
          else if (saved.toLowerCase().includes('en')) setLanguageState('en');
          else if (saved.toLowerCase().includes('ru')) setLanguageState('ru');
        }
      } catch {}
    })();
  }, []);

  const setLanguage = async (newLang: LanguageCode) => {
    setLanguageState(newLang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newLang);
    } catch {}
  };

  const t = (key: TranslationKey): string => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.az;
    return (dict as Record<string, string>)[key] || (TRANSLATIONS.az as Record<string, string>)[key] || key;
  };

  const currentLanguageOption =
    LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLanguageOption,
      }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}

