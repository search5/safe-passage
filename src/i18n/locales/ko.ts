import en from './en';

const ko: typeof en = {
  // Common
  UNLOCK: '잠금 해제',
  LOCK: '잠금',
  CANCEL: '취소',
  WARNING: '경고',
  ERROR: '오류',
  COPY: '복사',
  
  // Auth Modal
  UNLOCK_TITLE: 'SafePassage: "{profileName}" 잠금 해제',
  MASTER_PASSWORD: '마스터 패스워드',
  MASTER_PASSWORD_DESC: '데이터베이스의 마스터 비밀번호를 입력하십시오.',
  UNLOCK_SUCCESS: '"{profileName}" 프로필이 잠금 해제되었습니다.',
  UNLOCK_FAILED: '잠금 해제 실패: {message}',
  SESSION_EXPIRED: '세션이 만료되어 프로필 "{profileName}"이(가) 잠겼습니다.',
  ALL_LOCKED: '모든 데이터베이스가 안전하게 잠겼습니다.',
  
  // Commands & Notices (main.ts)
  COMMAND_LOCK_ALL: '모든 SafePassage 프로필 잠금',
  COMMAND_UNLOCK_MANUAL: '특정 프로필 잠금 해제',
  NO_PROFILES_CONFIGURED: '구성된 프로필이 없습니다. 설정 탭을 확인하십시오.',
  ALREADY_UNLOCKED: '이미 모든 프로필이 해제되어 있습니다.',
  KEYRING_AUTO_UNLOCKED: '키링을 통해 "{profileName}" 프로필이 자동 해제되었습니다.',
  PROFILE_UNLOCKED_NOTICE: '"{profileName}" 프로필이 잠금 해제되었습니다.',
  
  // Secret Editing Modal (2단계)
  INSERT_SECRET: '비밀 정보 삽입',
  EDIT_SECRET: '비밀 정보 수정',
  ADD_FIELD: '사용자 지정 필드 추가',
  SAVE: '저장',
  SELECT_PROFILE: '프로필 선택',
  ENTRY_PATH: '항목 경로 (예: Group/Entry)',
  USERNAME: '사용자 이름',
  PASSWORD: '비밀번호',
  URL: '웹 주소',
  NOTES: '메모',
  CUSTOM_FIELDS: '사용자 지정 필드 목록',
  FIELD_NAME: '필드명',
  FIELD_VALUE: '필드값',
  GENERATE_PASSWORD: '비밀번호 생성',
  READ_ONLY_WARNING: '이 프로필은 읽기 전용입니다.',
  DATABASE_LOCKED_WARNING: '프로필이 잠겨 있습니다. 먼저 잠금을 해제해 주세요.',
  SUCCESS_SAVE: '비밀 정보가 성공적으로 저장되었습니다.',
  SUCCESS_SAVE_TOKEN: '비밀 정보가 저장되었고 토큰이 삽입되었습니다.',
  FIELD_REQUIRED: '항목 경로, 사용자 이름, 비밀번호는 필수 입력 항목입니다.',
  
  // Clipboard
  COPIED_TIMEOUT: '클립보드에 복사되었습니다. (보안을 위해 {seconds}초 후 소거됩니다.)',
  COPIED: '클립보드에 복사되었습니다.',
  CLIPBOARD_CLEARED: '클립보드의 민감한 정보가 안전하게 소거되었습니다.',
  CLIPBOARD_FAILED: '클립보드 복사에 실패했습니다.',
  
  // Chips & Errors
  MISSING_PROFILE: '프로필 누락: {profileId}',
  MISSING_PROFILE_DESC: '설정에 "{profileId}" 프로필이 존재하지 않습니다.',
  PROFILE_LOCKED: '{profileName} (잠김)',
  PROFILE_LOCKED_DESC: '클릭하여 데이터베이스를 잠금 해제하십시오.',
  MISSING_ENTRY: '항목 없음: {entryName}',
  MISSING_ENTRY_DESC: '경로 내에 해당 엔트리를 찾을 수 없습니다: {entryPath}',
  MISSING_FIELD: '필드 없음: {fieldName}',
  MISSING_FIELD_DESC: '항목 내에 "{fieldName}" 필드가 존재하지 않습니다.',
  MISSING_FIELD_NOTICE: '존재하지 않는 필드이므로 복사할 수 없습니다. (필드명: {fieldName})',
  CLICK_TO_COPY: '클릭하여 클립보드에 복사하십시오.',

  // Code Block
  ENTRY_NAME: '항목명',
  ENTRY_MISSING: '항목 누락',
  PROFILE_IS_LOCKED_MSG: '🔒 "{profileName}" 프로필이 잠겨 있습니다. ',
  MISSING_PROFILE_MSG: '⚠ 오류: 프로필 "{profileId}"을(를) 찾을 수 없습니다.',
  MISSING_PROFILE_PROPERTY: '⚠ 오류: profile 속성이 지정되지 않았습니다.',
  EMPTY_FIELD_TEXT: '-',
  EMPTY_FIELD_DESC: '"{fieldName}" 필드가 데이터에 존재하지 않습니다.',

  // Settings
  SETTINGS_TITLE: 'SafePassage 설정',
  GLOBAL_SECURITY_SETTINGS: '전역 보안 및 복사 설정',
  CLIPBOARD_TIMEOUT: '클립보드 소거 시간(초)',
  CLIPBOARD_TIMEOUT_DESC: '크레덴셜 복사 후 클립보드를 비울 시간입니다. (0으로 설정 시 자동 소거 안 함)',
  KEYRING_ENABLE: '마스터 키링 활성화',
  KEYRING_ENABLE_DESC: '세션 동안 마스터 비밀번호를 로컬 세션 안전 메모리에 캐싱하여 자동 잠금 해제를 사용합니다.',
  DATABASE_PROFILES: 'KeePass 데이터베이스 프로필',
  NO_PROFILES_MSG: '등록된 프로필이 없습니다. 새 프로필을 추가하십시오.',
  ADD_NEW_PROFILE: '새 프로필 추가',
  PROFILE_NAME: '프로필 이름',
  DATABASE_PATH: '데이터베이스 파일 경로',
  DATABASE_PATH_DESC: '로컬 절대 파일 경로 (예: /Users/username/passwords.kdbx)',
  KEY_PATH: '키 파일 경로 (선택 사항)',
  KEY_PATH_DESC: '로컬 절대 파일 경로 (선택 사항)',
  READ_ONLY: '읽기 전용 (Read-Only)',
  READ_ONLY_DESC: '활성화 시 데이터베이스에 쓰거나 항목을 수정할 수 없습니다.',
  MANAGE_BY_KEYRING: '마스터 키링으로 관리',
  MANAGE_BY_KEYRING_DESC: '이 프로필의 암호를 세션 내에 키링으로 관리할지 지정합니다.',
  SESSION_LIFETIME: '세션 만료 수명',
  SESSION_LIFETIME_DESC: '잠금 해제 후 데이터베이스 세션이 만료될 시간입니다.',
  DELETE_PROFILE: '프로필 삭제',
  
  // Session Lifetime Options
  SESSION_SINGLE: '1회 조회 후 즉시 잠금',
  SESSION_5MIN: '5분',
  SESSION_15MIN: '15분',
  SESSION_FOREVER: 'Obsidian 종료 시까지',
};

export default ko;
