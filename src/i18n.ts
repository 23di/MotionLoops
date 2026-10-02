/** UI language is independent of motion documents and persisted preset identities. */
export const locales = ["en", "ja", "ko", "fr", "de", "es-ES", "es-419", "pt-BR"] as const;
export type Locale = typeof locales[number];
export type LanguagePreference = Locale | "auto";
export const languageStorageKey = "orbit-ui-language";
export const languageNames: Record<Locale, string> = {
  en: "English", ja: "日本語", ko: "한국어", fr: "Français", de: "Deutsch",
  "es-ES": "Español (España)", "es-419": "Español (Latinoamérica)", "pt-BR": "Português (Brasil)",
};
export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === "auto" || locales.includes(value as Locale);
}
export function resolveLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const tag = language.toLowerCase().replaceAll("_", "-");
    const [base, ...parts] = tag.split("-");
    const region = parts.find(part => /^(?:[a-z]{2}|\d{3})$/.test(part));
    if (base === "es") return !region || region === "es" ? "es-ES" : "es-419";
    if (base === "pt") return "pt-BR";
    if (["en", "ja", "ko", "fr", "de"].includes(base)) return base as Locale;
  }
  return "en";
}

// Columns: English | French | German | Spanish | Brazilian Portuguese | Japanese | Korean.
// Both Spanish regions share these UI terms; they retain separate preferences and lang tags.
const rows = `
Orbit|Orbite|Umlaufbahn|Órbita|Órbita|軌道|궤도
Language|Langue|Sprache|Idioma|Idioma|言語|언어
Automatic|Automatique|Automatisch|Automático|Automático|自動|자동
Motion|Mouvement|Bewegung|Movimiento|Movimento|モーション|모션
Cards|Cartes|Karten|Tarjetas|Cartões|カード|카드
Trajectory|Trajectoire|Pfad|Trayectoria|Trajetória|軌道|궤적
Other|Autres|Sonstiges|Otros|Outros|その他|기타
Advanced|Avancé|Erweitert|Avanzado|Avançado|詳細設定|고급
Model|Modèle|Modell|Modelo|Modelo|モデル|모델
Animation|Animation|Animation|Animación|Animação|アニメーション|애니메이션
Custom|Personnalisé|Benutzerdefiniert|Personalizado|Personalizado|カスタム|사용자 지정
Type|Type|Typ|Tipo|Tipo|種類|유형
Time|Temps|Zeit|Tiempo|Tempo|時間|시간
Physics|Physique|Physik|Física|Física|物理|물리
Ease|Courbe|Kurve|Curva|Curva|イージング|이징
Easing|Interpolation|Easing|Suavizado|Suavização|イージング|이징
Bounce|Rebond|Rückprall|Rebote|Quique|バウンス|바운스
Stiffness|Rigidité|Steifigkeit|Rigidez|Rigidez|剛性|강성
Damping|Amortissement|Dämpfung|Amortiguación|Amortecimento|減衰|감쇠
Mass|Masse|Masse|Masa|Massa|質量|질량
On|Activé|An|Activado|Ativado|オン|켜짐
Off|Désactivé|Aus|Desactivado|Desativado|オフ|꺼짐
Current|Actuel|Aktuell|Actual|Atual|現在|현재
Already saved|Déjà enregistré|Bereits gespeichert|Ya guardado|Já salvo|保存済み|이미 저장됨
Save current preset|Enregistrer le préréglage actuel|Aktuelle Vorgabe speichern|Guardar ajuste actual|Salvar predefinição atual|現在のプリセットを保存|현재 프리셋 저장
Delete saved preset|Supprimer le préréglage|Gespeicherte Vorgabe löschen|Eliminar ajuste guardado|Excluir predefinição salva|保存済みプリセットを削除|저장된 프리셋 삭제
Delete {name}|Supprimer {name}|{name} löschen|Eliminar {name}|Excluir {name}|{name}を削除|{name} 삭제
Choose preset|Choisir un préréglage|Vorgabe wählen|Elegir ajuste|Escolher predefinição|プリセットを選択|프리셋 선택
Presets|Préréglages|Vorgaben|Ajustes|Predefinições|プリセット|프리셋
Pin preview|Épingler l’aperçu|Vorschau anheften|Fijar vista previa|Fixar prévia|プレビューを固定|미리보기 고정
Unpin preview|Détacher l’aperçu|Vorschau lösen|Desfijar vista previa|Desafixar prévia|プレビューの固定を解除|미리보기 고정 해제
Pin preview while scrolling|Épingler l’aperçu pendant le défilement|Vorschau beim Scrollen anheften|Fijar vista previa al desplazar|Fixar prévia durante a rolagem|スクロール中もプレビューを固定|스크롤 중 미리보기 고정
Live animation preview|Aperçu de l’animation|Animationsvorschau|Vista previa de animación|Prévia da animação|アニメーションのプレビュー|애니메이션 미리보기
Animation presets|Préréglages d’animation|Animationsvorgaben|Ajustes de animación|Predefinições de animação|アニメーションのプリセット|애니메이션 프리셋
Animation settings|Paramètres d’animation|Animationseinstellungen|Ajustes de animación|Configurações de animação|アニメーション設定|애니메이션 설정
Quick settings|Réglages rapides|Schnelleinstellungen|Ajustes rápidos|Configurações rápidas|クイック設定|빠른 설정
Free libraries|Bibliothèques gratuites|Kostenlose Bibliotheken|Bibliotecas gratuitas|Bibliotecas gratuitas|無料ライブラリ|무료 라이브러리
Copy diagnostics|Copier le diagnostic|Diagnose kopieren|Copiar diagnóstico|Copiar diagnóstico|診断情報をコピー|진단 정보 복사
Diagnostics copied|Diagnostic copié|Diagnose kopiert|Diagnóstico copiado|Diagnóstico copiado|診断情報をコピーしました|진단 정보 복사됨
Import settings|Importer les paramètres|Einstellungen importieren|Importar ajustes|Importar configurações|設定をインポート|설정 가져오기
Paste settings JSON (⌘V / Ctrl+V)|Coller les paramètres JSON (⌘V / Ctrl+V)|Einstellungs-JSON einfügen (⌘V / Ctrl+V)|Pegar ajustes JSON (⌘V / Ctrl+V)|Colar configurações JSON (⌘V / Ctrl+V)|設定JSONを貼り付け (⌘V / Ctrl+V)|설정 JSON 붙여넣기 (⌘V / Ctrl+V)
Cancel|Annuler|Abbrechen|Cancelar|Cancelar|キャンセル|취소
Import JSON|Importer le JSON|JSON importieren|Importar JSON|Importar JSON|JSONをインポート|JSON 가져오기
Clear|Effacer|Entfernen|Borrar|Limpar|クリア|지우기
Clearing…|Suppression…|Wird entfernt…|Borrando…|Limpando…|クリア中…|지우는 중…
Updating…|Mise à jour…|Wird aktualisiert…|Actualizando…|Atualizando…|更新中…|업데이트 중…
Refresh motion|Actualiser le mouvement|Bewegung aktualisieren|Actualizar movimiento|Atualizar movimento|モーションを更新|모션 새로고침
Apply motion|Appliquer le mouvement|Bewegung anwenden|Aplicar movimiento|Aplicar movimento|モーションを適用|모션 적용
Copy JSON|Copier le JSON|JSON kopieren|Copiar JSON|Copiar JSON|JSONをコピー|JSON 복사
Paste|Coller|Einfügen|Pegar|Colar|貼り付け|붙여넣기
Reset settings|Réinitialiser les paramètres|Einstellungen zurücksetzen|Restablecer ajustes|Redefinir configurações|設定をリセット|설정 초기화
Scope|Cible|Zielbereich|Ámbito|Escopo|対象範囲|적용 범위
Selected layers|Calques sélectionnés|Ausgewählte Ebenen|Capas seleccionadas|Camadas selecionadas|選択したレイヤー|선택한 레이어
Frame children|Enfants du cadre|Direkte Kinder des Frames|Elementos del marco|Elementos do quadro|フレームの子要素|프레임의 자식 요소
Deep descendants|Tous les descendants|Alle untergeordneten Ebenen|Todos los descendientes|Todos os descendentes|すべての子孫要素|모든 하위 요소
Center before apply|Centrer avant application|Vor dem Anwenden zentrieren|Centrar antes de aplicar|Centralizar antes de aplicar|適用前に中央揃え|적용 전 가운데 정렬
Service layers|Calques auxiliaires|Hilfsebenen|Capas auxiliares|Camadas auxiliares|補助レイヤー|보조 레이어
Start when card is main|Démarrer quand la carte est principale|Starten, wenn Karte im Fokus ist|Iniciar al destacar la tarjeta|Iniciar quando o cartão é principal|カードがメインになったら開始|카드가 메인이 되면 시작
Loop card animation|Boucler l’animation de la carte|Kartenanimation wiederholen|Repetir animación de tarjeta|Repetir animação do cartão|カードのアニメーションをループ|카드 애니메이션 반복
Offset|Décalage|Versatz|Desfase|Deslocamento|オフセット|오프셋
Cycle duration|Durée du cycle|Zyklusdauer|Duración del ciclo|Duração do ciclo|サイクルの長さ|주기 길이
Transition duration|Durée de transition|Übergangsdauer|Duración de transición|Duração da transição|トランジションの長さ|전환 시간
Stagger|Décalage entre cartes|Zeitversatz|Escalonamiento|Escalonamento|時間差|시차
Radius pulse|Pulsation du rayon|Radiuspuls|Pulso del radio|Pulso do raio|半径のパルス|반지름 펄스
Scale pulse|Pulsation de l’échelle|Skalierungspuls|Pulso de escala|Pulso de escala|スケールのパルス|크기 펄스
Opacity pulse|Pulsation de l’opacité|Deckkraftpuls|Pulso de opacidad|Pulso de opacidade|不透明度のパルス|불투명도 펄스
Depth pulse|Pulsation de profondeur|Tiefenpuls|Pulso de profundidad|Pulso de profundidade|奥行きのパルス|깊이 펄스
Queue transition|Transition de file|Warteschlangenübergang|Transición de cola|Transição da fila|キューのトランジション|대기열 전환
Queue easing|Interpolation de file|Warteschlangen-Easing|Suavizado de cola|Suavização da fila|キューのイージング|대기열 이징
Path size|Taille du tracé|Pfadgröße|Tamaño de trayectoria|Tamanho da trajetória|パスのサイズ|경로 크기
Direction|Direction|Richtung|Dirección|Direção|方向|방향
Card size|Taille des cartes|Kartengröße|Tamaño de tarjeta|Tamanho do cartão|カードサイズ|카드 크기
Adaptive card size|Taille adaptative des cartes|Adaptive Kartengröße|Tamaño adaptativo de tarjeta|Tamanho adaptável do cartão|カードサイズを自動調整|카드 크기 자동 조정
Front scale|Échelle avant|Vordere Skalierung|Escala frontal|Escala frontal|手前のスケール|앞쪽 크기
Back scale|Échelle arrière|Hintere Skalierung|Escala posterior|Escala posterior|奥のスケール|뒤쪽 크기
Back opacity|Opacité arrière|Hintere Deckkraft|Opacidad posterior|Opacidade posterior|奥の不透明度|뒤쪽 불투명도
Spread|Dispersion|Streuung|Dispersión|Dispersão|広がり|퍼짐
Spacing|Espacement|Abstand|Espaciado|Espaçamento|間隔|간격
Gap|Écart|Abstand|Separación|Espaço|間隔|간격
Pause|Pause|Pause|Pausa|Pausa|一時停止|일시 정지
Corner radius|Rayon des coins|Eckenradius|Radio de esquina|Raio dos cantos|角丸|모서리 반경
Offset X|Décalage X|Versatz X|Desplazamiento X|Deslocamento X|Xオフセット|X 오프셋
Offset Y|Décalage Y|Versatz Y|Desplazamiento Y|Deslocamento Y|Yオフセット|Y 오프셋
Card aspect|Proportions des cartes|Kartenseitenverhältnis|Proporción de tarjeta|Proporção do cartão|カードの縦横比|카드 종횡비
Image fit|Ajustement de l’image|Bildanpassung|Ajuste de imagen|Ajuste da imagem|画像のフィット|이미지 맞춤
Horizontal radius|Rayon horizontal|Horizontaler Radius|Radio horizontal|Raio horizontal|水平方向の半径|가로 반지름
Vertical radius|Rayon vertical|Vertikaler Radius|Radio vertical|Raio vertical|垂直方向の半径|세로 반지름
Angle|Angle|Winkel|Ángulo|Ângulo|角度|각도
Tilt|Inclinaison|Neigung|Inclinación|Inclinação|傾き|기울기
Depth|Profondeur|Tiefe|Profundidad|Profundidade|奥行き|깊이
Card tilt|Inclinaison des cartes|Kartenneigung|Inclinación de tarjeta|Inclinação do cartão|カードの傾き|카드 기울기
Card rotation|Rotation des cartes|Kartendrehung|Rotación de tarjeta|Rotação do cartão|カードの回転|카드 회전
Shape|Forme|Form|Forma|Forma|形状|모양
Fit inside frame|Ajuster au cadre|In Frame einpassen|Ajustar al marco|Ajustar ao quadro|フレーム内に収める|프레임 안에 맞추기
Clockwise|Sens horaire|Im Uhrzeigersinn|Sentido horario|Sentido horário|時計回り|시계 방향
Counterclockwise|Sens antihoraire|Gegen den Uhrzeigersinn|Sentido antihorario|Sentido anti-horário|反時計回り|반시계 방향
Line|Ligne|Linie|Línea|Linha|直線|직선
Ellipse|Ellipse|Ellipse|Elipse|Elipse|楕円|타원
Crosscurrent|Courants croisés|Kreuzströmung|Corrientes cruzadas|Correntes cruzadas|交差する流れ|교차 흐름
Tile wave|Vague de tuiles|Kachelwelle|Onda de mosaicos|Onda de mosaicos|タイルの波|타일 웨이브
Custom path|Tracé personnalisé|Benutzerdefinierter Pfad|Trayectoria personalizada|Trajetória personalizada|カスタムパス|사용자 지정 경로
Parametric|Paramétrique|Parametrisch|Paramétrico|Paramétrico|パラメトリック|파라메트릭
Sphere|Sphère|Kugel|Esfera|Esfera|球体|구체
Deck|Paquet|Kartenstapel|Baraja|Baralho|デッキ|덱
Shuffle|Mélange|Mischen|Mezcla|Embaralhar|シャッフル|섞기
Falling stack|Pile descendante|Fallender Stapel|Pila descendente|Pilha descendente|落下するスタック|낙하 스택
Tunnel|Tunnel|Tunnel|Túnel|Túnel|トンネル|터널
Cylinder|Cylindre|Zylinder|Cilindro|Cilindro|円筒|원통
Racetrack|Circuit|Rennstrecke|Circuito|Pista|レーストラック|레이스 트랙
Focus deck|Paquet focalisé|Fokusstapel|Baraja enfocada|Baralho em foco|フォーカスデッキ|포커스 덱
Fan|Éventail|Fächer|Abanico|Leque|扇形|부채꼴
Pendulum|Pendule|Pendel|Péndulo|Pêndulo|振り子|진자
Vortex|Tourbillon|Wirbel|Vórtice|Vórtice|渦|소용돌이
Cosine|Cosinus|Kosinus|Coseno|Cosseno|コサイン|코사인
Sine|Sinus|Sinus|Seno|Seno|サイン|사인
Turns|Tours|Umdrehungen|Vueltas|Voltas|周回数|회전 수
Orient3d|Orientation 3D|3D-Ausrichtung|Orientación 3D|Orientação 3D|3Dの向き|3D 방향
Shape amount|Intensité de la forme|Formstärke|Intensidad de forma|Intensidade da forma|形状の強さ|모양 강도
Depth falloff|Atténuation de profondeur|Tiefenabfall|Atenuación de profundidad|Atenuação de profundidade|奥行きの減衰|깊이 감쇠
Depth wave|Vague de profondeur|Tiefenwelle|Onda de profundidad|Onda de profundidade|奥行きの波|깊이 웨이브
Depth frequency|Fréquence de profondeur|Tiefenfrequenz|Frecuencia de profundidad|Frequência de profundidade|奥行きの周波数|깊이 주파수
Depth amplitude|Amplitude de profondeur|Tiefenamplitude|Amplitud de profundidad|Amplitude de profundidade|奥行きの振幅|깊이 진폭
Depth phase|Phase de profondeur|Tiefenphase|Fase de profundidad|Fase de profundidade|奥行きの位相|깊이 위상
X wave|Onde X|X-Welle|Onda X|Onda X|X波形|X 파형
Y wave|Onde Y|Y-Welle|Onda Y|Onda Y|Y波形|Y 파형
X frequency|Fréquence X|X-Frequenz|Frecuencia X|Frequência X|X周波数|X 주파수
Y frequency|Fréquence Y|Y-Frequenz|Frecuencia Y|Frequência Y|Y周波数|Y 주파수
X amplitude|Amplitude X|X-Amplitude|Amplitud X|Amplitude X|X振幅|X 진폭
Y amplitude|Amplitude Y|Y-Amplitude|Amplitud Y|Amplitude Y|Y振幅|Y 진폭
X phase|Phase X|X-Phase|Fase X|Fase X|X位相|X 위상
Y phase|Phase Y|Y-Phase|Fase Y|Fase Y|Y位相|Y 위상
Y offset|Décalage Y|Y-Versatz|Desplazamiento Y|Deslocamento Y|Yオフセット|Y 오프셋
Size basis|Base de taille|Größenbasis|Base de tamaño|Base do tamanho|サイズの基準|크기 기준
Standard|Standard|Standard|Estándar|Padrão|標準|표준
Row|Rangée|Reihe|Fila|Fileira|列|행
Fade start|Début du fondu|Ausblendbeginn|Inicio de desvanecimiento|Início do fade|フェード開始|페이드 시작
Fade end|Fin du fondu|Ausblendende|Fin de desvanecimiento|Fim do fade|フェード終了|페이드 끝
Opacity curve|Courbe d’opacité|Deckkraftkurve|Curva de opacidad|Curva de opacidade|不透明度のカーブ|불투명도 곡선
Linear|Linéaire|Linear|Lineal|Linear|リニア|선형
Early fade|Fondu précoce|Frühes Ausblenden|Desvanecimiento temprano|Fade antecipado|早めのフェード|빠른 페이드
Late fade|Fondu tardif|Spätes Ausblenden|Desvanecimiento tardío|Fade tardio|遅めのフェード|늦은 페이드
Soft|Doux|Weich|Suave|Suave|ソフト|부드럽게
Sharp|Net|Scharf|Marcado|Acentuado|シャープ|급격하게
Far blur|Flou arrière|Hintere Unschärfe|Desenfoque posterior|Desfoque posterior|奥のぼかし|뒤쪽 흐림
Front shadow|Ombre avant|Vorderer Schatten|Sombra frontal|Sombra frontal|手前の影|앞쪽 그림자
Face path|Orienter selon le tracé|Am Pfad ausrichten|Orientar según trayectoria|Orientar pela trajetória|パスに沿って向ける|경로 방향으로 정렬
Queue|File|Warteschlange|Cola|Fila|キュー|대기열
Continuous|Continu|Kontinuierlich|Continuo|Contínuo|連続|연속
Pulse|Pulsation|Puls|Pulso|Pulso|パルス|펄스
Zoom|Zoom|Zoom|Zoom|Zoom|ズーム|확대
Pulse + Zoom|Pulsation + Zoom|Puls + Zoom|Pulso + Zoom|Pulso + Zoom|パルス＋ズーム|펄스 + 확대
Fade|Fondu|Ausblenden|Desvanecimiento|Fade|フェード|페이드
Stack|Pile|Stapel|Pila|Pilha|スタック|스택
Strobe|Stroboscope|Stroboskop|Estrobo|Estrobo|ストロボ|스트로브
Expand|Expansion|Erweitern|Expandir|Expandir|拡大|확장
Circle|Cercle|Kreis|Círculo|Círculo|円|원
Reorder|Réordonner|Neu anordnen|Reordenar|Reordenar|並べ替え|재정렬
Scatter|Dispersion|Verteilen|Dispersar|Dispersar|散布|분산
Down|Bas|Unten|Abajo|Para baixo|下|아래
Up|Haut|Oben|Arriba|Para cima|上|위
Left|Gauche|Links|Izquierda|Esquerda|左|왼쪽
Right|Droite|Rechts|Derecha|Direita|右|오른쪽
Center|Centre|Mitte|Centro|Centro|中央|가운데
Top|Haut|Oben|Arriba|Topo|上|위
Bottom|Bas|Unten|Abajo|Base|下|아래
Cycles|Cycles|Zyklen|Ciclos|Ciclos|サイクル数|주기 수
Visible cards|Cartes visibles|Sichtbare Karten|Tarjetas visibles|Cartões visíveis|表示するカード|표시 카드 수
Perspective|Perspective|Perspektive|Perspectiva|Perspectiva|遠近感|원근감
Scale center|Agrandir au centre|Mitte skalieren|Escalar en el centro|Ampliar no centro|中央を拡大|가운데 확대
Scale focus|Foyer d’agrandissement|Skalierungsfokus|Foco de escala|Foco da escala|スケールの焦点|크기 조절 기준
Tilt style|Style d’inclinaison|Neigungsstil|Estilo de inclinación|Estilo de inclinação|傾きのスタイル|기울기 스타일
Uniform|Uniforme|Einheitlich|Uniforme|Uniforme|均一|균일
Alternate|Alterné|Abwechselnd|Alterno|Alternado|交互|교대로
Solo|Seule carte|Einzelkarte|Tarjeta única|Cartão único|単一カード|단일 카드
Depth fade|Fondu de profondeur|Tiefenausblendung|Desvanecimiento por profundidad|Fade de profundidade|奥行きのフェード|깊이 페이드
Exit fade|Fondu de sortie|Ausblenden beim Verlassen|Desvanecimiento de salida|Fade de saída|退出時のフェード|퇴장 페이드
Effect|Effet|Effekt|Efecto|Efeito|エフェクト|효과
Pacing|Rythme|Tempo|Ritmo|Ritmo|ペース|진행 속도
Equal|Constant|Gleichmäßig|Constante|Constante|均等|일정하게
Eased|Interpolé|Geglättet|Suavizado|Suavizado|緩急あり|완급 있게
Scale|Échelle|Skalierung|Escala|Escala|スケール|크기
Drift|Dérive|Drift|Deriva|Deslocamento|ドリフト|드리프트
Scale dir|Sens d’échelle|Skalierungsrichtung|Dirección de escala|Direção da escala|スケールの方向|크기 방향
Drift dir|Sens de dérive|Driftrichtung|Dirección de deriva|Direção do deslocamento|ドリフトの方向|드리프트 방향
Forward|Avant|Vorwärts|Adelante|Para frente|順方向|정방향
Reverse|Inverse|Rückwärts|Inverso|Inverso|逆方向|역방향
Scale amount|Intensité d’échelle|Skalierungsstärke|Intensidad de escala|Intensidade da escala|スケールの強さ|크기 강도
Drift amount|Intensité de dérive|Driftstärke|Intensidad de deriva|Intensidade do deslocamento|ドリフトの強さ|드리프트 강도
Scale style|Style d’échelle|Skalierungsstil|Estilo de escala|Estilo da escala|スケールのスタイル|크기 스타일
Bloom|Floraison|Aufblühen|Floración|Florescer|開花|피어남
Recede|Recul|Zurückweichen|Retroceder|Recuar|後退|후퇴
Grow from|Point de croissance|Wachstumsursprung|Crecer desde|Crescer a partir de|拡大の基準|확대 기준
Fit|Ajuster|Einpassen|Ajustar|Ajustar|フィット|맞춤
Fill|Remplir|Füllen|Rellenar|Preencher|塗りつぶし|채우기
Spin|Rotation|Drehung|Giro|Giro|回転|회전
Natural|Naturel|Natürlich|Natural|Natural|元の比率|원본 비율
Ring width|Largeur de l’anneau|Ringbreite|Ancho del anillo|Largura do anel|リングの幅|링 너비
Ring height|Hauteur de l’anneau|Ringhöhe|Altura del anillo|Altura do anel|リングの高さ|링 높이
Rings|Anneaux|Ringe|Anillos|Anéis|リング数|링 수
Ring gap|Espacement des anneaux|Ringabstand|Separación de anillos|Espaço entre anéis|リングの間隔|링 간격
Inner radius|Rayon intérieur|Innenradius|Radio interior|Raio interno|内側の半径|안쪽 반지름
Inward|Vers l’intérieur|Nach innen|Hacia dentro|Para dentro|内向き|안쪽으로
Outward|Vers l’extérieur|Nach außen|Hacia fuera|Para fora|外向き|바깥쪽으로
Visible objects|Objets visibles|Sichtbare Objekte|Objetos visibles|Objetos visíveis|表示するオブジェクト|표시 객체 수
Drift direction|Direction de dérive|Driftrichtung|Dirección de deriva|Direção do deslocamento|ドリフトの方向|드리프트 방향
Drift speed|Vitesse de dérive|Driftgeschwindigkeit|Velocidad de deriva|Velocidade do deslocamento|ドリフト速度|드리프트 속도
Down and left|Bas et gauche|Unten links|Abajo e izquierda|Para baixo e à esquerda|左下|왼쪽 아래
Down and right|Bas et droite|Unten rechts|Abajo y derecha|Para baixo e à direita|右下|오른쪽 아래
Up and left|Haut et gauche|Oben links|Arriba e izquierda|Para cima e à esquerda|左上|왼쪽 위
Up and right|Haut et droite|Oben rechts|Arriba y derecha|Para cima e à direita|右上|오른쪽 위
Leftwards|Vers la gauche|Nach links|Hacia la izquierda|Para a esquerda|左方向|왼쪽으로
Rightwards|Vers la droite|Nach rechts|Hacia la derecha|Para a direita|右方向|오른쪽으로
Follow curve|Suivre la courbe|Kurve folgen|Seguir curva|Seguir curva|カーブに沿う|곡선 따라가기
Fan angle|Angle de l’éventail|Fächerwinkel|Ángulo del abanico|Ângulo do leque|扇形の角度|부채꼴 각도
Stack lift|Élévation de la pile|Stapelhöhe|Elevación de pila|Elevação da pilha|スタックの持ち上げ|스택 높이
Stacking|Empilement|Stapelreihenfolge|Apilamiento|Empilhamento|重なり順|쌓기 순서
First on top|Premier au-dessus|Erste oben|Primero arriba|Primeiro em cima|最初を最前面に|첫 번째를 맨 위에
Last on top|Dernier au-dessus|Letzte oben|Último arriba|Último em cima|最後を最前面に|마지막을 맨 위에
Edge fade|Fondu des bords|Randausblendung|Desvanecimiento de bordes|Fade nas bordas|端のフェード|가장자리 페이드
Repeats|Répétitions|Wiederholungen|Repeticiones|Repetições|繰り返し回数|반복 횟수
Elastic|Élastique|Elastisch|Elástico|Elástico|弾性|탄성
Smooth|Fluide|Sanft|Suave|Suave|なめらか|부드럽게
Snappy|Vif|Knackig|Ágil|Ágil|きびきび|빠르게
Contour|Contour|Kontur|Contorno|Contorno|輪郭|윤곽
Globe|Globe|Globus|Globo|Globo|地球儀|구형
Coil|Spirale|Spirale|Espiral|Espiral|コイル|코일
Cards travel around a shared center|Les cartes tournent autour d’un centre commun|Karten bewegen sich um einen gemeinsamen Mittelpunkt|Las tarjetas giran alrededor de un centro común|Os cartões giram em torno de um centro comum|共通の中心を回るカード|공통 중심을 도는 카드
Cards follow a tilted spatial orbit|Les cartes suivent une orbite spatiale inclinée|Karten folgen einer geneigten räumlichen Umlaufbahn|Las tarjetas siguen una órbita espacial inclinada|Os cartões seguem uma órbita espacial inclinada|傾いた空間軌道を回るカード|기울어진 공간 궤도를 따르는 카드
Cards cross along a spatial figure eight|Les cartes suivent un huit dans l’espace|Karten kreuzen sich auf einer räumlichen Acht|Las tarjetas recorren un ocho espacial|Os cartões percorrem um oito no espaço|空間の8の字を交差するカード|공간의 8자 궤도를 교차하는 카드
A compact tilted orbit with a paced rotation|Une orbite inclinée compacte à rotation rythmée|Kompakte geneigte Umlaufbahn mit rhythmischer Drehung|Órbita inclinada compacta con rotación rítmica|Órbita inclinada compacta com rotação ritmada|テンポよく回転するコンパクトな傾斜軌道|규칙적으로 회전하는 작은 기울어진 궤도
A continuous stream along a shaped path|Un flux continu le long d’un tracé|Kontinuierlicher Strom entlang eines geformten Pfads|Flujo continuo por una trayectoria definida|Fluxo contínuo por uma trajetória definida|形状パスに沿った連続した流れ|모양 경로를 따라 이어지는 흐름
A rotating cloud of cards|Un nuage de cartes en rotation|Eine rotierende Kartenwolke|Nube de tarjetas en rotación|Nuvem de cartões em rotação|回転するカードの雲|회전하는 카드 구름
Cards sweep in and out around the center|Les cartes vont et viennent autour du centre|Karten schwingen um die Mitte hinein und hinaus|Las tarjetas entran y salen alrededor del centro|Os cartões entram e saem ao redor do centro|中心の周りを出入りするカード|중심 주변을 오가는 카드
Cards gather, open like petals, then return|Les cartes se rassemblent, s’ouvrent en pétales puis reviennent|Karten sammeln sich, öffnen sich wie Blütenblätter und kehren zurück|Las tarjetas se agrupan, abren como pétalos y vuelven|Os cartões se agrupam, abrem como pétalas e retornam|カードが集まり花びらのように開いて戻る|카드가 모여 꽃잎처럼 펼쳐졌다 돌아옴
Cards circulate around a wide spatial track|Les cartes circulent sur un large circuit spatial|Karten kreisen auf einer breiten räumlichen Bahn|Las tarjetas circulan por una pista espacial amplia|Os cartões circulam por uma pista espacial ampla|広い空間トラックを周回するカード|넓은 공간 트랙을 도는 카드
Editable native animation|Animation native modifiable|Bearbeitbare native Animation|Animación nativa editable|Animação nativa editável|編集可能なネイティブアニメーション|편집 가능한 네이티브 애니메이션
Resize plugin height|Redimensionner la hauteur du plugin|Plugin-Höhe ändern|Cambiar altura del plugin|Alterar altura do plugin|プラグインの高さを変更|플러그인 높이 조절
Drag to resize · Arrow keys change height|Glisser pour redimensionner · Flèches pour changer la hauteur|Ziehen zum Ändern · Pfeiltasten ändern die Höhe|Arrastrar para cambiar tamaño · Flechas para cambiar altura|Arraste para redimensionar · Setas alteram a altura|ドラッグでサイズ変更・矢印キーで高さ変更|드래그로 크기 조절 · 방향키로 높이 변경
Stack shape preview|Aperçu de la forme de pile|Vorschau der Stapelform|Vista previa de forma de pila|Prévia da forma da pilha|スタック形状のプレビュー|스택 모양 미리보기
Trajectory preview|Aperçu de trajectoire|Pfadvorschau|Vista previa de trayectoria|Prévia da trajetória|軌道のプレビュー|궤적 미리보기
Edit a closed motion path|Modifier un tracé fermé|Geschlossenen Bewegungspfad bearbeiten|Editar trayectoria cerrada|Editar trajetória fechada|閉じたモーションパスを編集|닫힌 모션 경로 편집
Draw an open motion path|Dessiner un tracé ouvert|Offenen Bewegungspfad zeichnen|Dibujar trayectoria abierta|Desenhar trajetória aberta|開いたモーションパスを描く|열린 모션 경로 그리기
Ellipse fitted automatically to the selected frame|Ellipse ajustée automatiquement au cadre sélectionné|Ellipse automatisch an ausgewählten Frame angepasst|Elipse ajustada al marco seleccionado|Elipse ajustada ao quadro selecionado|選択フレームに自動調整された楕円|선택한 프레임에 자동으로 맞춘 타원
Adjust ellipse width and height|Ajuster la largeur et la hauteur de l’ellipse|Breite und Höhe der Ellipse anpassen|Ajustar ancho y alto de elipse|Ajustar largura e altura da elipse|楕円の幅と高さを調整|타원의 너비와 높이 조절
Adjust orbit width|Ajuster la largeur de l’orbite|Breite der Umlaufbahn anpassen|Ajustar ancho de órbita|Ajustar largura da órbita|軌道の幅を調整|궤도 너비 조절
Adjust orbit height|Ajuster la hauteur de l’orbite|Höhe der Umlaufbahn anpassen|Ajustar alto de órbita|Ajustar altura da órbita|軌道の高さを調整|궤도 높이 조절
Rotate orbit|Tourner l’orbite|Umlaufbahn drehen|Rotar órbita|Girar órbita|軌道を回転|궤도 회전
Tilt orbit|Incliner l’orbite|Umlaufbahn neigen|Inclinar órbita|Inclinar órbita|軌道を傾ける|궤도 기울이기
Adjust line length|Ajuster la longueur de ligne|Linienlänge anpassen|Ajustar longitud de línea|Ajustar comprimento da linha|直線の長さを調整|직선 길이 조절
Rotate line|Tourner la ligne|Linie drehen|Rotar línea|Girar linha|直線を回転|직선 회전
Start animations inside each card when it becomes the front or central card.|Démarrer les animations internes quand la carte passe au premier plan ou au centre.|Animationen innerhalb jeder Karte starten, wenn sie vorne oder in der Mitte ist.|Iniciar animaciones internas al pasar la tarjeta al frente o al centro.|Iniciar animações internas quando o cartão fica à frente ou no centro.|カードが手前または中央になったら内部のアニメーションを開始します。|카드가 앞쪽이나 가운데에 오면 내부 애니메이션을 시작합니다.
Repeat animations inside each card. Independent loops fit whole cycles into the scene duration. Start when card is main restarts the authored loop on each visit.|Répéter les animations internes. Les boucles indépendantes adaptent les cycles entiers à la scène. Le démarrage à la carte principale relance la boucle à chaque passage.|Kartenanimationen wiederholen. Unabhängige Schleifen passen ganze Zyklen in die Szenendauer ein. Beim Fokus wird die ursprüngliche Schleife bei jedem Besuch neu gestartet.|Repetir animaciones internas. Los bucles independientes ajustan ciclos completos a la escena. Iniciar al destacar reinicia el bucle en cada paso.|Repetir animações internas. Loops independentes ajustam ciclos inteiros à cena. Iniciar quando principal reinicia o loop a cada passagem.|カード内のアニメーションを繰り返します。独立ループはシーンの長さに合わせて整数回再生します。メイン時の開始は毎回元のループを再開します。|카드 내부 애니메이션을 반복합니다. 독립 반복은 장면 길이에 전체 주기를 맞춥니다. 메인이 될 때마다 원래 반복을 다시 시작합니다.
Negative starts earlier; positive starts later. Double-press the handle to reset to zero.|Une valeur négative avance le début ; une valeur positive le retarde. Double-cliquer sur la poignée pour remettre à zéro.|Negative Werte starten früher, positive später. Griff doppelt drücken, um auf null zurückzusetzen.|Un valor negativo adelanta el inicio; uno positivo lo retrasa. Pulsa dos veces el control para volver a cero.|Valores negativos antecipam o início; positivos atrasam. Pressione duas vezes a alça para voltar a zero.|負の値は早く、正の値は遅く開始します。ハンドルを2回押すとゼロに戻ります。|음수는 일찍, 양수는 늦게 시작합니다. 핸들을 두 번 눌러 0으로 초기화합니다.
Settings JSON copied.|Paramètres JSON copiés.|Einstellungs-JSON kopiert.|Ajustes JSON copiados.|Configurações JSON copiadas.|設定JSONをコピーしました。|설정 JSON을 복사했습니다.
Settings JSON pasted.|Paramètres JSON importés.|Einstellungs-JSON eingefügt.|Ajustes JSON pegados.|Configurações JSON coladas.|設定JSONを貼り付けました。|설정 JSON을 붙여넣었습니다.
Clipboard access is unavailable.|Accès au presse-papiers indisponible.|Zwischenablage nicht verfügbar.|Acceso al portapapeles no disponible.|Acesso à área de transferência indisponível.|クリップボードにアクセスできません。|클립보드에 접근할 수 없습니다.
Could not copy diagnostics.|Impossible de copier le diagnostic.|Diagnose konnte nicht kopiert werden.|No se pudo copiar el diagnóstico.|Não foi possível copiar o diagnóstico.|診断情報をコピーできませんでした。|진단 정보를 복사할 수 없습니다.
Could not copy settings JSON.|Impossible de copier les paramètres JSON.|Einstellungs-JSON konnte nicht kopiert werden.|No se pudieron copiar los ajustes JSON.|Não foi possível copiar as configurações JSON.|設定JSONをコピーできませんでした。|설정 JSON을 복사할 수 없습니다.
Could not paste settings JSON.|Impossible d’importer les paramètres JSON.|Einstellungs-JSON konnte nicht eingefügt werden.|No se pudieron pegar los ajustes JSON.|Não foi possível colar as configurações JSON.|設定JSONを貼り付けできませんでした。|설정 JSON을 붙여넣을 수 없습니다.
Clipboard is empty.|Le presse-papiers est vide.|Die Zwischenablage ist leer.|El portapapeles está vacío.|A área de transferência está vazia.|クリップボードが空です。|클립보드가 비어 있습니다.
Settings JSON is too large.|Les paramètres JSON sont trop volumineux.|Einstellungs-JSON ist zu groß.|El JSON de ajustes es demasiado grande.|O JSON de configurações é muito grande.|設定JSONのサイズが大きすぎます。|설정 JSON이 너무 큽니다.
Clipboard does not contain valid JSON.|Le presse-papiers ne contient pas de JSON valide.|Die Zwischenablage enthält kein gültiges JSON.|El portapapeles no contiene JSON válido.|A área de transferência não contém JSON válido.|クリップボードに有効なJSONがありません。|클립보드에 유효한 JSON이 없습니다.
This is not a Motion Loops settings JSON.|Ce JSON ne contient pas de paramètres Motion Loops.|Dies ist kein Einstellungs-JSON von Motion Loops.|Este JSON no contiene ajustes de Motion Loops.|Este JSON não contém configurações do Motion Loops.|これはMotion Loopsの設定JSONではありません。|Motion Loops 설정 JSON이 아닙니다.
Cycle duration must be positive.|La durée du cycle doit être positive.|Die Zyklusdauer muss positiv sein.|La duración del ciclo debe ser positiva.|A duração do ciclo deve ser positiva.|サイクルの長さは正の値にしてください。|주기 길이는 양수여야 합니다.
Card size must be non-negative.|La taille des cartes ne peut pas être négative.|Die Kartengröße darf nicht negativ sein.|El tamaño de tarjeta no puede ser negativo.|O tamanho do cartão não pode ser negativo.|カードサイズは0以上にしてください。|카드 크기는 0 이상이어야 합니다.
{path} must be a finite number.|{path} doit être un nombre fini.|{path} muss eine endliche Zahl sein.|{path} debe ser un número finito.|{path} deve ser um número finito.|{path}は有限の数値にしてください。|{path}은(는) 유한한 숫자여야 합니다.
{path} has the wrong type.|{path} a un type incorrect.|{path} hat den falschen Typ.|{path} tiene un tipo incorrecto.|{path} tem o tipo incorreto.|{path}の型が正しくありません。|{path}의 유형이 잘못되었습니다.
{path} must be an object.|{path} doit être un objet.|{path} muss ein Objekt sein.|{path} debe ser un objeto.|{path} deve ser um objeto.|{path}はオブジェクトにしてください。|{path}은(는) 객체여야 합니다.
{path} contains an unsupported value.|{path} contient une valeur non prise en charge.|{path} enthält einen nicht unterstützten Wert.|{path} contiene un valor no compatible.|{path} contém um valor não suportado.|{path}に未対応の値があります。|{path}에 지원되지 않는 값이 있습니다.
{path} must contain {count} finite numbers.|{path} doit contenir {count} nombres finis.|{path} muss {count} endliche Zahlen enthalten.|{path} debe contener {count} números finitos.|{path} deve conter {count} números finitos.|{path}には{count}個の有限の数値が必要です。|{path}에는 유한한 숫자 {count}개가 필요합니다.
{path} must be at least {min}.|{path} doit être au moins égal à {min}.|{path} muss mindestens {min} sein.|{path} debe ser al menos {min}.|{path} deve ser pelo menos {min}.|{path}は{min}以上にしてください。|{path}은(는) {min} 이상이어야 합니다.
Units|Unités|Einheiten|Unidades|Unidades|単位|단위
Percent|Pourcentage|Prozent|Porcentaje|Porcentagem|パーセント|백분율
Bézier coordinates|Coordonnées de Bézier|Bézier-Koordinaten|Coordenadas de Bézier|Coordenadas de Bézier|ベジェ座標|베지어 좌표
Add easing preset|Ajouter une courbe|Easing-Vorgabe hinzufügen|Añadir ajuste de suavizado|Adicionar predefinição de suavização|イージングのプリセットを追加|이징 프리셋 추가
Easing presets|Courbes prédéfinies|Easing-Vorgaben|Ajustes de suavizado|Predefinições de suavização|イージングのプリセット|이징 프리셋
Invalid motion document.|Document d’animation invalide.|Ungültiges Bewegungsdokument.|Documento de movimiento no válido.|Documento de movimento inválido.|モーションドキュメントが無効です。|모션 문서가 잘못되었습니다.
Unsupported motion document version.|Version du document non prise en charge.|Nicht unterstützte Dokumentversion.|Versión del documento no compatible.|Versão do documento não suportada.|未対応のモーションドキュメントのバージョンです。|지원되지 않는 모션 문서 버전입니다.
Unsupported preset identity.|Préréglage non pris en charge.|Nicht unterstützte Vorgabe.|Identidad de ajuste no compatible.|Identidade da predefinição não suportada.|未対応のプリセットです。|지원되지 않는 프리셋입니다.
Incomplete motion document.|Document d’animation incomplet.|Unvollständiges Bewegungsdokument.|Documento de movimiento incompleto.|Documento de movimento incompleto.|モーションドキュメントが不完全です。|모션 문서가 불완전합니다.
Unsupported selection scope.|Cible non prise en charge.|Nicht unterstützter Zielbereich.|Ámbito de selección no compatible.|Escopo de seleção não suportado.|未対応の選択範囲です。|지원되지 않는 선택 범위입니다.
Invalid output settings.|Paramètres de sortie invalides.|Ungültige Ausgabeeinstellungen.|Ajustes de salida no válidos.|Configurações de saída inválidas.|出力設定が無効です。|출력 설정이 잘못되었습니다.
Invalid animation entry timing.|Début d’animation invalide.|Ungültige Startzeit der Animation.|Tiempo de entrada no válido.|Tempo de entrada da animação inválido.|アニメーションの開始タイミングが無効です。|애니메이션 시작 타이밍이 잘못되었습니다.
Invalid easing.|Interpolation invalide.|Ungültiges Easing.|Suavizado no válido.|Suavização inválida.|イージングが無効です。|이징이 잘못되었습니다.
Invalid easing coordinates.|Coordonnées d’interpolation invalides.|Ungültige Easing-Koordinaten.|Coordenadas de suavizado no válidas.|Coordenadas de suavização inválidas.|イージングの座標が無効です。|이징 좌표가 잘못되었습니다.
Invalid easing duration.|Durée d’interpolation invalide.|Ungültige Easing-Dauer.|Duración de suavizado no válida.|Duração da suavização inválida.|イージングの長さが無効です。|이징 시간이 잘못되었습니다.
This motion model supports Bézier easing, not spring physics.|Ce modèle prend en charge les courbes de Bézier, pas les ressorts.|Dieses Modell unterstützt Bézier-Easing, keine Federphysik.|Este modelo admite suavizado Bézier, no física de muelles.|Este modelo aceita suavização Bézier, não física de molas.|このモデルはベジェイージングに対応し、スプリング物理には対応しません。|이 모델은 베지어 이징을 지원하며 스프링 물리는 지원하지 않습니다.
Select cards in one top-level frame.|Sélectionnez des cartes dans un seul cadre de premier niveau.|Karten in einem einzigen obersten Frame auswählen.|Selecciona tarjetas en un solo marco de nivel superior.|Selecione cartões em um único quadro de nível superior.|1つの最上位フレーム内のカードを選択してください。|하나의 최상위 프레임 안에서 카드를 선택하세요.
Select and unlock all cards of this animation before refreshing it.|Sélectionnez et déverrouillez toutes les cartes avant d’actualiser.|Vor dem Aktualisieren alle Karten dieser Animation auswählen und entsperren.|Selecciona y desbloquea todas las tarjetas antes de actualizar.|Selecione e desbloqueie todos os cartões antes de atualizar.|更新前にこのアニメーションの全カードを選択しロック解除してください。|새로고침 전에 모든 카드를 선택하고 잠금을 해제하세요.
This composition produced no visible cards. Adjust the Row settings before applying.|Cette composition ne produit aucune carte visible. Ajustez la rangée avant d’appliquer.|Diese Komposition erzeugt keine sichtbaren Karten. Reiheneinstellungen vor dem Anwenden anpassen.|Esta composición no genera tarjetas visibles. Ajusta la fila antes de aplicar.|Esta composição não gerou cartões visíveis. Ajuste a fileira antes de aplicar.|表示されるカードがありません。適用前に列の設定を調整してください。|표시되는 카드가 없습니다. 적용 전에 행 설정을 조정하세요.
The containing frame became unavailable.|Le cadre contenant les cartes n’est plus disponible.|Der umgebende Frame ist nicht mehr verfügbar.|El marco contenedor dejó de estar disponible.|O quadro que contém os cartões ficou indisponível.|親フレームが利用できなくなりました。|상위 프레임을 사용할 수 없게 되었습니다.
A source card became unavailable.|Une carte source n’est plus disponible.|Eine Quellkarte ist nicht mehr verfügbar.|Una tarjeta de origen dejó de estar disponible.|Um cartão de origem ficou indisponível.|元のカードが利用できなくなりました。|원본 카드를 사용할 수 없게 되었습니다.
This source type cannot be used as an editable card.|Ce type de source ne peut pas être utilisé comme carte modifiable.|Dieser Quelltyp kann nicht als bearbeitbare Karte verwendet werden.|Este tipo de origen no puede usarse como tarjeta editable.|Este tipo de origem não pode ser usado como cartão editável.|この種類の要素は編集可能なカードとして使用できません。|이 원본 유형은 편집 가능한 카드로 사용할 수 없습니다.
This Figma version does not support native Motion tracks on frames.|Cette version de Figma ne prend pas en charge les pistes Motion sur les cadres.|Diese Figma-Version unterstützt keine nativen Motion-Spuren auf Frames.|Esta versión de Figma no admite pistas Motion nativas en marcos.|Esta versão do Figma não aceita faixas Motion nativas em quadros.|このFigmaバージョンはフレームのネイティブMotionトラックに対応していません。|이 Figma 버전은 프레임의 네이티브 Motion 트랙을 지원하지 않습니다.
A source card became unavailable before commit.|Une carte source est devenue indisponible avant la validation.|Eine Quellkarte wurde vor dem Speichern unzugänglich.|Una tarjeta de origen dejó de estar disponible antes de guardar.|Um cartão de origem ficou indisponível antes de salvar.|確定前に元のカードが利用できなくなりました。|저장 전에 원본 카드를 사용할 수 없게 되었습니다.
Sections can't be animated. Select the cards inside a frame.|Les sections ne peuvent pas être animées. Sélectionnez les cartes dans un cadre.|Sections können nicht animiert werden. Karten in einem Frame auswählen.|Las secciones no pueden animarse. Selecciona tarjetas dentro de un marco.|Seções não podem ser animadas. Selecione cartões dentro de um quadro.|セクションはアニメーションできません。フレーム内のカードを選択してください。|섹션은 애니메이션할 수 없습니다. 프레임 안의 카드를 선택하세요.
Sections can't be animated. Select a frame or layers inside it.|Les sections ne peuvent pas être animées. Sélectionnez un cadre ou ses calques.|Sections können nicht animiert werden. Einen Frame oder darin enthaltene Ebenen auswählen.|Las secciones no pueden animarse. Selecciona un marco o sus capas.|Seções não podem ser animadas. Selecione um quadro ou suas camadas.|セクションはアニメーションできません。フレームか内部レイヤーを選択してください。|섹션은 애니메이션할 수 없습니다. 프레임이나 내부 레이어를 선택하세요.
Unlock all cards of the native animation before replacing it.|Déverrouillez toutes les cartes de l’animation avant de la remplacer.|Vor dem Ersetzen alle Karten der nativen Animation entsperren.|Desbloquea todas las tarjetas de la animación antes de reemplazarla.|Desbloqueie todos os cartões da animação antes de substituí-la.|置換前にネイティブアニメーションの全カードをロック解除してください。|교체 전에 네이티브 애니메이션의 모든 카드 잠금을 해제하세요.
Locked layers are ignored. Unlock a layer to animate it.|Les calques verrouillés sont ignorés. Déverrouillez un calque pour l’animer.|Gesperrte Ebenen werden ignoriert. Zum Animieren eine Ebene entsperren.|Las capas bloqueadas se ignoran. Desbloquea una capa para animarla.|Camadas bloqueadas são ignoradas. Desbloqueie uma camada para animá-la.|ロックしたレイヤーは無視されます。アニメーションするにはロック解除してください。|잠긴 레이어는 제외됩니다. 애니메이션하려면 잠금을 해제하세요.
Select layers inside a top-level frame, or select the frame to animate its children.|Sélectionnez des calques dans un cadre de premier niveau ou le cadre pour animer ses enfants.|Ebenen in einem obersten Frame auswählen oder den Frame zum Animieren seiner Kinder auswählen.|Selecciona capas en un marco de nivel superior o el marco para animar sus elementos.|Selecione camadas em um quadro de nível superior ou o quadro para animar seus elementos.|最上位フレーム内のレイヤーか、子要素をアニメーションするフレームを選択してください。|최상위 프레임 안의 레이어 또는 자식 요소를 애니메이션할 프레임을 선택하세요.
No Motion Loops motion in the current selection.|Aucune animation Motion Loops dans la sélection.|Keine Motion-Loops-Animation in der aktuellen Auswahl.|La selección no contiene movimiento de Motion Loops.|A seleção não contém movimento do Motion Loops.|現在の選択にMotion Loopsのモーションがありません。|현재 선택에 Motion Loops 모션이 없습니다.
Figma Motion is unavailable for this selection.|Figma Motion n’est pas disponible pour cette sélection.|Figma Motion ist für diese Auswahl nicht verfügbar.|Figma Motion no está disponible para esta selección.|Figma Motion não está disponível para esta seleção.|この選択ではFigma Motionを使用できません。|이 선택에서는 Figma Motion을 사용할 수 없습니다.
Motion Loops could not clear motion from the selected layers.|Motion Loops n’a pas pu effacer l’animation des calques sélectionnés.|Motion Loops konnte die Bewegung der ausgewählten Ebenen nicht entfernen.|Motion Loops no pudo borrar el movimiento de las capas seleccionadas.|O Motion Loops não conseguiu limpar o movimento das camadas selecionadas.|選択レイヤーのモーションをクリアできませんでした。|선택한 레이어의 모션을 지울 수 없습니다.
{preset} needs {min}–{max} selected cards.|{preset} nécessite {min}–{max} cartes sélectionnées.|{preset} benötigt {min}–{max} ausgewählte Karten.|{preset} necesita {min}–{max} tarjetas seleccionadas.|{preset} precisa de {min}–{max} cartões selecionados.|{preset}には{min}～{max}枚の選択カードが必要です。|{preset}에는 선택한 카드 {min}~{max}개가 필요합니다.
Visible cards can be at most {max} with {count} selected cards.|Avec {count} cartes sélectionnées, au plus {max} cartes peuvent être visibles.|Bei {count} ausgewählten Karten können höchstens {max} sichtbar sein.|Con {count} tarjetas seleccionadas, pueden verse como máximo {max}.|Com {count} cartões selecionados, no máximo {max} podem ficar visíveis.|{count}枚選択時に表示できるカードは最大{max}枚です。|카드 {count}개를 선택하면 최대 {max}개를 표시할 수 있습니다.
{count} nested animation track(s) kept their original timing because Figma does not support editing them: {details}.|{count} piste(s) imbriquée(s) conservent leur timing original car Figma ne permet pas de les modifier : {details}.|{count} verschachtelte Animationsspur(en) behalten ihre ursprüngliche Zeitplanung, da Figma sie nicht bearbeiten kann: {details}.|{count} pistas anidadas conservan su tiempo original porque Figma no permite editarlas: {details}.|{count} faixas aninhadas mantêm o tempo original porque o Figma não permite editá-las: {details}.|Figmaで編集できないため、{count}本の内部アニメーショントラックは元のタイミングを保持しています: {details}。|Figma에서 편집할 수 없어 내부 애니메이션 트랙 {count}개는 원래 타이밍을 유지합니다: {details}.
{label} must be finite.|{label} doit être un nombre fini.|{label} muss endlich sein.|{label} debe ser finito.|{label} deve ser finito.|{label}は有限の値にしてください。|{label}은(는) 유한한 값이어야 합니다.
{label} is below its minimum.|{label} est inférieur au minimum.|{label} liegt unter dem Minimum.|{label} está por debajo del mínimo.|{label} está abaixo do mínimo.|{label}が最小値を下回っています。|{label}이(가) 최솟값보다 작습니다.
Missing parameter: {label}|Paramètre manquant : {label}|Fehlender Parameter: {label}|Falta el parámetro: {label}|Parâmetro ausente: {label}|パラメーターがありません: {label}|누락된 매개변수: {label}
Unsupported {label}|{label} non pris en charge|{label} wird nicht unterstützt|{label} no compatible|{label} não suportado|未対応: {label}|지원되지 않음: {label}
Invalid {label}|{label} invalide|{label} ist ungültig|{label} no válido|{label} inválido|無効: {label}|잘못된 값: {label}
Bézier easing curve|Courbe de Bézier|Bézier-Easing-Kurve|Curva de Bézier|Curva de Bézier|ベジェイージングカーブ|베지어 이징 곡선
Bézier handle {count}: X {x}, Y {y}|Poignée de Bézier {count} : X {x}, Y {y}|Bézier-Griff {count}: X {x}, Y {y}|Control Bézier {count}: X {x}, Y {y}|Alça Bézier {count}: X {x}, Y {y}|ベジェハンドル{count}: X {x}, Y {y}|베지어 핸들 {count}: X {x}, Y {y}
Drag to adjust X from 0 to 1 and Y from -1 to 2. Arrow keys adjust by 0.01. Shift adjusts by 0.1. Escape cancels a drag.|Glisser pour ajuster X de 0 à 1 et Y de -1 à 2. Les flèches ajustent de 0,01, Maj de 0,1. Échap annule le glissement.|Ziehen, um X von 0 bis 1 und Y von -1 bis 2 anzupassen. Pfeiltasten ändern um 0,01, Umschalt um 0,1. Escape bricht ab.|Arrastra para ajustar X de 0 a 1 e Y de -1 a 2. Las flechas ajustan 0,01; Mayús, 0,1. Esc cancela.|Arraste para ajustar X de 0 a 1 e Y de -1 a 2. Setas ajustam 0,01; Shift, 0,1. Esc cancela.|ドラッグでXを0～1、Yを-1～2に調整します。矢印キーは0.01、Shiftは0.1ずつ変更します。Escでドラッグをキャンセルします。|드래그로 X를 0~1, Y를 -1~2로 조절합니다. 방향키는 0.01, Shift는 0.1씩 조절합니다. Esc로 취소합니다.
The source layer became unavailable.|Le calque source n’est plus disponible.|Die Quellebene ist nicht mehr verfügbar.|La capa de origen dejó de estar disponible.|A camada de origem ficou indisponível.|元のレイヤーが利用できなくなりました。|원본 레이어를 사용할 수 없게 되었습니다.
The source layer became unavailable while duplicating services.|Le calque source est devenu indisponible lors de la duplication des calques auxiliaires.|Die Quellebene wurde beim Duplizieren der Hilfsebenen unzugänglich.|La capa de origen dejó de estar disponible al duplicar capas auxiliares.|A camada de origem ficou indisponível ao duplicar camadas auxiliares.|補助レイヤーの複製中に元のレイヤーが利用できなくなりました。|보조 레이어 복제 중 원본 레이어를 사용할 수 없게 되었습니다.
The source layer became unavailable after duplicating services.|Le calque source est devenu indisponible après duplication des calques auxiliaires.|Die Quellebene wurde nach dem Duplizieren der Hilfsebenen unzugänglich.|La capa de origen dejó de estar disponible tras duplicar capas auxiliares.|A camada de origem ficou indisponível após duplicar camadas auxiliares.|補助レイヤーの複製後に元のレイヤーが利用できなくなりました。|보조 레이어 복제 후 원본 레이어를 사용할 수 없게 되었습니다.
This layer cannot be duplicated for depth sorting.|Ce calque ne peut pas être dupliqué pour le tri en profondeur.|Diese Ebene kann nicht für die Tiefensortierung dupliziert werden.|Esta capa no puede duplicarse para ordenar por profundidad.|Esta camada não pode ser duplicada para ordenar por profundidade.|このレイヤーは奥行きの並べ替え用に複製できません。|이 레이어는 깊이 정렬을 위해 복제할 수 없습니다.
The source parent became unavailable while ordering services.|Le parent de la source est devenu indisponible pendant le tri des calques auxiliaires.|Das Quellelternelement wurde beim Anordnen der Hilfsebenen unzugänglich.|El elemento padre dejó de estar disponible al ordenar capas auxiliares.|O elemento pai ficou indisponível ao ordenar camadas auxiliares.|補助レイヤーの並べ替え中に元の親要素が利用できなくなりました。|보조 레이어 정렬 중 원본 상위 요소를 사용할 수 없게 되었습니다.
Update verification failed: the animation timeline is unavailable.|Échec de vérification : la timeline d’animation est indisponible.|Aktualisierungsprüfung fehlgeschlagen: Animationszeitleiste nicht verfügbar.|Falló la verificación: la línea de tiempo no está disponible.|Falha na verificação: a linha do tempo está indisponível.|更新の検証に失敗しました: アニメーションのタイムラインが利用できません。|업데이트 검증 실패: 애니메이션 타임라인을 사용할 수 없습니다.
Update verification failed: no animation timeline was found.|Échec de vérification : aucune timeline d’animation trouvée.|Aktualisierungsprüfung fehlgeschlagen: Keine Animationszeitleiste gefunden.|Falló la verificación: no se encontró línea de tiempo.|Falha na verificação: nenhuma linha do tempo encontrada.|更新の検証に失敗しました: アニメーションのタイムラインが見つかりません。|업데이트 검증 실패: 애니메이션 타임라인이 없습니다.
Update stopped while removing an obsolete service layer.|La mise à jour s’est arrêtée en supprimant un calque auxiliaire obsolète.|Aktualisierung beim Entfernen einer veralteten Hilfsebene gestoppt.|La actualización se detuvo al eliminar una capa auxiliar obsoleta.|A atualização parou ao remover uma camada auxiliar obsoleta.|古い補助レイヤーの削除中に更新が停止しました。|이전 보조 레이어를 제거하다 업데이트가 중단되었습니다.
Update verification failed: a source parent is unavailable.|Échec de vérification : un parent de source est indisponible.|Aktualisierungsprüfung fehlgeschlagen: Ein Quellelternelement ist nicht verfügbar.|Falló la verificación: un elemento padre no está disponible.|Falha na verificação: um elemento pai está indisponível.|更新の検証に失敗しました: 元の親要素が利用できません。|업데이트 검증 실패: 원본 상위 요소를 사용할 수 없습니다.
Service parent became unavailable while ordering.|Le parent auxiliaire est devenu indisponible pendant le tri.|Das Hilfselternelement wurde beim Anordnen unzugänglich.|El elemento padre auxiliar dejó de estar disponible al ordenar.|O elemento pai auxiliar ficou indisponível durante a ordenação.|並べ替え中に補助レイヤーの親要素が利用できなくなりました。|정렬 중 보조 레이어의 상위 요소를 사용할 수 없게 되었습니다.
Service layer became unavailable while ordering.|Un calque auxiliaire est devenu indisponible pendant le tri.|Eine Hilfsebene wurde beim Anordnen unzugänglich.|Una capa auxiliar dejó de estar disponible al ordenar.|Uma camada auxiliar ficou indisponível durante a ordenação.|並べ替え中に補助レイヤーが利用できなくなりました。|정렬 중 보조 레이어를 사용할 수 없게 되었습니다.
Update verification failed: a source layer is unavailable.|Échec de vérification : un calque source est indisponible.|Aktualisierungsprüfung fehlgeschlagen: Eine Quellebene ist nicht verfügbar.|Falló la verificación: una capa de origen no está disponible.|Falha na verificação: uma camada de origem está indisponível.|更新の検証に失敗しました: 元のレイヤーが利用できません。|업데이트 검증 실패: 원본 레이어를 사용할 수 없습니다.
The source became unavailable during Clear.|La source est devenue indisponible pendant l’effacement.|Die Quelle wurde beim Entfernen unzugänglich.|El origen dejó de estar disponible al borrar.|A origem ficou indisponível durante a limpeza.|クリア中に元の要素が利用できなくなりました。|지우는 중 원본 요소를 사용할 수 없게 되었습니다.
Clear verification failed: a source layer became unavailable.|Échec de vérification de l’effacement : un calque source est indisponible.|Entfernungsprüfung fehlgeschlagen: Eine Quellebene ist nicht mehr verfügbar.|Falló la verificación de borrado: una capa de origen no está disponible.|Falha na verificação de limpeza: uma camada de origem está indisponível.|クリアの検証に失敗しました: 元のレイヤーが利用できなくなりました。|지우기 검증 실패: 원본 레이어를 사용할 수 없게 되었습니다.
Clear verification failed: a service layer remains.|Échec de vérification de l’effacement : un calque auxiliaire subsiste.|Entfernungsprüfung fehlgeschlagen: Eine Hilfsebene verbleibt.|Falló la verificación de borrado: queda una capa auxiliar.|Falha na verificação de limpeza: resta uma camada auxiliar.|クリアの検証に失敗しました: 補助レイヤーが残っています。|지우기 검증 실패: 보조 레이어가 남아 있습니다.
Service layer {count} became unavailable.|Le calque auxiliaire {count} est devenu indisponible.|Hilfsebene {count} ist nicht mehr verfügbar.|La capa auxiliar {count} dejó de estar disponible.|A camada auxiliar {count} ficou indisponível.|補助レイヤー{count}が利用できなくなりました。|보조 레이어 {count}을(를) 사용할 수 없게 되었습니다.
Service layer {count} became unavailable after insertion.|Le calque auxiliaire {count} est devenu indisponible après insertion.|Hilfsebene {count} wurde nach dem Einfügen unzugänglich.|La capa auxiliar {count} dejó de estar disponible tras insertarla.|A camada auxiliar {count} ficou indisponível após a inserção.|挿入後に補助レイヤー{count}が利用できなくなりました。|삽입 후 보조 레이어 {count}을(를) 사용할 수 없게 되었습니다.
Could not reset motion on the copy of {name}.|Impossible de réinitialiser l’animation de la copie de {name}.|Bewegung auf der Kopie von {name} konnte nicht zurückgesetzt werden.|No se pudo restablecer el movimiento de la copia de {name}.|Não foi possível redefinir o movimento na cópia de {name}.|{name}のコピーのモーションをリセットできませんでした。|{name} 복사본의 모션을 초기화할 수 없습니다.
Could not replace motion on {name}.|Impossible de remplacer l’animation de {name}.|Bewegung auf {name} konnte nicht ersetzt werden.|No se pudo reemplazar el movimiento de {name}.|Não foi possível substituir o movimento em {name}.|{name}のモーションを置換できませんでした。|{name}의 모션을 교체할 수 없습니다.
Update verification failed for {name}: incomplete animation tracks.|Échec de vérification pour {name} : pistes d’animation incomplètes.|Aktualisierungsprüfung für {name} fehlgeschlagen: Unvollständige Animationsspuren.|Falló la verificación de {name}: pistas incompletas.|Falha na verificação de {name}: faixas incompletas.|{name}の更新検証に失敗しました: アニメーショントラックが不完全です。|{name} 업데이트 검증 실패: 애니메이션 트랙이 불완전합니다.
Clear verification failed for {name}: animation tracks remain.|Échec de l’effacement pour {name} : des pistes d’animation subsistent.|Entfernungsprüfung für {name} fehlgeschlagen: Animationsspuren verbleiben.|Falló la verificación de borrado de {name}: quedan pistas.|Falha na verificação de limpeza de {name}: restam faixas.|{name}のクリア検証に失敗しました: アニメーショントラックが残っています。|{name} 지우기 검증 실패: 애니메이션 트랙이 남아 있습니다.
Clear verification failed for {name}: Motion Loops metadata remains.|Échec de l’effacement pour {name} : des métadonnées Motion Loops subsistent.|Entfernungsprüfung für {name} fehlgeschlagen: Motion-Loops-Metadaten verbleiben.|Falló la verificación de borrado de {name}: quedan metadatos de Motion Loops.|Falha na verificação de limpeza de {name}: restam metadados do Motion Loops.|{name}のクリア検証に失敗しました: Motion Loopsのメタデータが残っています。|{name} 지우기 검증 실패: Motion Loops 메타데이터가 남아 있습니다.
Update verification failed for {name}: expected {expected} service layers, found {actual}.|Échec de vérification pour {name} : {expected} calques auxiliaires attendus, {actual} trouvés.|Aktualisierungsprüfung für {name} fehlgeschlagen: {expected} Hilfsebenen erwartet, {actual} gefunden.|Falló la verificación de {name}: se esperaban {expected} capas auxiliares, se encontraron {actual}.|Falha na verificação de {name}: esperadas {expected} camadas auxiliares, encontradas {actual}.|{name}の更新検証に失敗しました: 補助レイヤーは{expected}個の予定ですが{actual}個見つかりました。|{name} 업데이트 검증 실패: 보조 레이어 {expected}개가 필요하지만 {actual}개가 있습니다.
Clear verification failed for {name}: {count} service layers remain.|Échec de l’effacement pour {name} : {count} calques auxiliaires subsistent.|Entfernungsprüfung für {name} fehlgeschlagen: {count} Hilfsebenen verbleiben.|Falló la verificación de borrado de {name}: quedan {count} capas auxiliares.|Falha na verificação de limpeza de {name}: restam {count} camadas auxiliares.|{name}のクリア検証に失敗しました: 補助レイヤーが{count}個残っています。|{name} 지우기 검증 실패: 보조 레이어 {count}개가 남아 있습니다.
Update stopped; no old service layers were removed. {details}|Mise à jour arrêtée ; aucun ancien calque auxiliaire supprimé. {details}|Aktualisierung gestoppt; keine alten Hilfsebenen entfernt. {details}|Actualización detenida; no se eliminaron capas auxiliares antiguas. {details}|Atualização interrompida; nenhuma camada auxiliar antiga removida. {details}|更新を停止しました。古い補助レイヤーは削除していません。{details}|업데이트 중단; 이전 보조 레이어를 제거하지 않았습니다. {details}
Update verification failed: service layers could not be ordered safely. {details}|Échec de vérification : les calques auxiliaires n’ont pas pu être ordonnés correctement. {details}|Aktualisierungsprüfung fehlgeschlagen: Hilfsebenen konnten nicht sicher angeordnet werden. {details}|Falló la verificación: no se pudieron ordenar las capas auxiliares de forma segura. {details}|Falha na verificação: não foi possível ordenar as camadas auxiliares com segurança. {details}|更新の検証に失敗しました: 補助レイヤーを安全に並べ替えできませんでした。{details}|업데이트 검증 실패: 보조 레이어를 안전하게 정렬할 수 없습니다. {details}
Update failed: {error}. Could not restore {details}. Undo this operation in Figma.|Échec de mise à jour : {error}. Impossible de restaurer {details}. Annulez cette opération dans Figma.|Aktualisierung fehlgeschlagen: {error}. {details} konnte nicht wiederhergestellt werden. Diesen Vorgang in Figma rückgängig machen.|Falló la actualización: {error}. No se pudo restaurar {details}. Deshaz esta operación en Figma.|Falha na atualização: {error}. Não foi possível restaurar {details}. Desfaça esta operação no Figma.|更新に失敗しました: {error}。{details}を復元できませんでした。Figmaでこの操作を元に戻してください。|업데이트 실패: {error}. {details}을(를) 복원할 수 없습니다. Figma에서 이 작업을 실행 취소하세요.
Clear stopped before completing {count} layers. Run Clear again; unfinished Motion Loops data was preserved for recovery. {details}|Effacement arrêté avant de terminer {count} calques. Relancez l’effacement ; les données inachevées ont été conservées pour récupération. {details}|Entfernen vor Abschluss von {count} Ebenen gestoppt. Erneut entfernen; unvollständige Motion-Loops-Daten wurden zur Wiederherstellung aufbewahrt. {details}|El borrado se detuvo antes de completar {count} capas. Vuelve a borrar; los datos pendientes se conservaron para recuperación. {details}|A limpeza parou antes de concluir {count} camadas. Execute novamente; os dados pendentes foram preservados para recuperação. {details}|{count}レイヤーの完了前にクリアが停止しました。再度クリアしてください。未完了データは復元用に保持されています。{details}|레이어 {count}개를 완료하기 전에 지우기가 중단되었습니다. 다시 지우세요. 미완료 데이터는 복구를 위해 유지되었습니다. {details}
`;
const columns: Locale[] = ["en", "fr", "de", "es-ES", "pt-BR", "ja", "ko"];
const normalize = (value: string) => value.toLowerCase();
export const translations: Record<string, Record<Locale, string>> = {};
for (const row of rows.trim().split("\n")) {
  const cells = row.split("|");
  if (cells.length !== columns.length || cells.some(cell => !cell)) throw new Error("Incomplete translation: " + cells[0]);
  const entry = Object.fromEntries(columns.map((locale, i) => [locale, cells[i]])) as Record<Locale, string>;
  entry["es-419"] = entry["es-ES"];
  translations[normalize(cells[0])] = entry;
}
const aliases: Record<string, string> = {cilinder:"cylinder", anticlockwise:"counterclockwise"};
export function translate(text: string, locale: Locale, params: Record<string, string | number> = {}): string {
  let result = text;
  if (locale !== "en") {
    const key = normalize(text);
    const direct = translations[aliases[key] ?? key]?.[locale];
    if (direct) result = direct;
    else {
      // Unit suffixes and built-in recipe numbers are presentation, never saved IDs.
      const match = text.match(/^(.*?)( \((?:%|°|s)\)| \d{2})$/);
      if (match) result = translate(match[1], locale) + match[2];
    }
  }
  return result.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match));
}
export function translateMessage(message: string, locale: Locale): string {
  if (locale === "en") return message;
  if (translations[normalize(message)]) return translate(message, locale);
  const patterns: Array<[RegExp, string, string[]]> = [
    [/^Service layer (\d+) became unavailable\.$/, "Service layer {count} became unavailable.", ["count"]],
    [/^Service layer (\d+) became unavailable after insertion\.$/, "Service layer {count} became unavailable after insertion.", ["count"]],
    [/^Could not reset motion on the copy of (.*)\.$/, "Could not reset motion on the copy of {name}.", ["name"]],
    [/^Could not replace motion on (.*)\.$/, "Could not replace motion on {name}.", ["name"]],
    [/^Update verification failed for (.*): incomplete animation tracks\.$/, "Update verification failed for {name}: incomplete animation tracks.", ["name"]],
    [/^Clear verification failed for (.*): animation tracks remain\.$/, "Clear verification failed for {name}: animation tracks remain.", ["name"]],
    [/^Clear verification failed for (.*): Motion Loops metadata remains\.$/, "Clear verification failed for {name}: Motion Loops metadata remains.", ["name"]],
    [/^Update verification failed for (.*): expected (\d+) service layers?, found (\d+)\.$/, "Update verification failed for {name}: expected {expected} service layers, found {actual}.", ["name", "expected", "actual"]],
    [/^Clear verification failed for (.*): (\d+) service layers? remain\.$/, "Clear verification failed for {name}: {count} service layers remain.", ["name", "count"]],
    [/^Update stopped; no old service layers were removed\. (.*)$/, "Update stopped; no old service layers were removed. {details}", ["details"]],
    [/^Update verification failed: service layers could not be ordered safely\.(?: (.*))?$/, "Update verification failed: service layers could not be ordered safely. {details}", ["details"]],
    [/^Update failed: (.*)\. Could not restore (.*)\. Undo this operation in Figma\.$/, "Update failed: {error}. Could not restore {details}. Undo this operation in Figma.", ["error", "details"]],
    [/^Clear stopped before completing (\d+) layers?\. Run Clear again; unfinished Motion Loops data was preserved for recovery\. (.*)$/, "Clear stopped before completing {count} layers. Run Clear again; unfinished Motion Loops data was preserved for recovery. {details}", ["count", "details"]],
    [/^(.*?) needs (\d+)–(\d+) selected cards\.$/, "{preset} needs {min}–{max} selected cards.", ["preset", "min", "max"]],
    [/^Visible cards can be at most (\d+) with (\d+) selected cards\.$/, "Visible cards can be at most {max} with {count} selected cards.", ["max", "count"]],
    [/^\s*(\d+) nested animation track\(s\) kept their original timing because Figma does not support editing them: (.*)\.$/, "{count} nested animation track(s) kept their original timing because Figma does not support editing them: {details}.", ["count", "details"]],
    [/^(.*?) must be finite\.$/, "{label} must be finite.", ["label"]],
    [/^(.*?) is below its minimum\.$/, "{label} is below its minimum.", ["label"]],
    [/^Missing parameter: (.*)$/, "Missing parameter: {label}", ["label"]],
    [/^Unsupported (.*)$/, "Unsupported {label}", ["label"]],
    [/^Invalid (.*)$/, "Invalid {label}", ["label"]],
    [/^(.*?) must be a finite number\.$/, "{path} must be a finite number.", ["path"]],
    [/^(.*?) has the wrong type\.$/, "{path} has the wrong type.", ["path"]],
    [/^(.*?) must be an object\.$/, "{path} must be an object.", ["path"]],
    [/^(.*?) contains an unsupported value\.$/, "{path} contains an unsupported value.", ["path"]],
    [/^(.*?) must contain (\d+) finite numbers\.$/, "{path} must contain {count} finite numbers.", ["path", "count"]],
    [/^(.*?) must be at least (.*?)\.$/, "{path} must be at least {min}.", ["path", "min"]],
  ];
  for (const [pattern, template, keys] of patterns) {
    const match = message.match(pattern);
    if (match) return translate(template, locale, Object.fromEntries(keys.map((key, i) => [key, ["label", "preset"].includes(key) ? translate(match[i + 1], locale) : key === "error" ? translateMessage(match[i + 1], locale) : match[i + 1] ?? ""])));
  }
  return translate(message, locale);
}
