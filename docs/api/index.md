---
layout: instruction
title: External Heat Bridge API v1
---

# External Heat Bridge API v1

Статус: единый публичный контракт Heat Controller для Android 9+.

Версия протокола: `1`.

Транспорт: Android Binder `Messenger` + `Message.what` + `Bundle`.
Дата ревизии документа: 2026-09-03

## 1. Назначение

External Heat Bridge API позволяет одному явно разрешённому Android-приложению:

- получать полное состояние четырёх нагревателей;
- узнавать состояние соединения Heat Controller с платой;
- отображать бинарный режим, двухуровневый или трёхуровневый цикл мощности;
- выполнять действие, эквивалентное нажатию штатной кнопки конкретного места;
- запрашивать повтор последнего полного состояния;
- получать результат проверки команды и уведомление об отключении API.

API предназначен для внешних приложений и их собственных интерфейсов или
виджетов на том же головном устройстве. Исходники Heat Controller, AIDL и общая
библиотека не требуются: контракт использует только классы Android SDK.

## 2. Границы контракта

В External Heat Bridge API v1 входят только сообщения `20000–20006`, описанные
в этом документе.

В API v1 не входят:

- внутренний WebSocket- и HTTP-обмен Heat Controller с платой;
- raw-команды контроллера;
- изменение настроек платы или приложения;
- настройка автоподогрева;
- прямая установка процента мощности или номера уровня;
- обновление приложения или прошивки;
- другие IPC-интеграции Heat Controller;
- Broadcast Intent, `BroadcastReceiver` или AIDL;
- диагностические строки монитора как машинный интерфейс.

Клиент не должен формировать или отправлять внутренние команды платы. Любое
управление выполняется только через публичную команду `PRESS_SEAT`.

## 3. Определение направлений

Направления во всём документе указаны относительно Heat Controller:

- **входящее сообщение**: внешнее приложение → Heat Controller;
- **исходящее сообщение**: Heat Controller → внешнее приложение.

| `what` | Имя | Направление | Назначение |
|---:|---|---|---|
| `20000` | `HELLO` | Входящее | Согласовать версию и зарегистрировать клиента |
| `20001` | `HELLO_ACK` | Исходящее | Подтвердить версию и возможности API |
| `20002` | `STATE_SNAPSHOT` | Исходящее | Передать полное состояние всех четырёх мест |
| `20003` | `PRESS_SEAT` | Входящее | Выполнить штатное нажатие для одного места |
| `20004` | `COMMAND_RESULT` | Исходящее | Сообщить, принята или отклонена команда |
| `20005` | `REQUEST_STATE` | Входящее | Запросить повтор актуального полного состояния |
| `20006` | `BRIDGE_DISABLED` | Исходящее | Сообщить, что владелец отключил API |

Неизвестные значения `Message.what` Heat Controller игнорирует без ответа.

### 3.1. Рабочий контракт внешних виджетов

Для повседневной работы виджетов используются только два функциональных
сообщения:

| Роль | Сообщение | Что делает |
|---|---|---|
| Команда управления | Входящий `PRESS_SEAT` (`20003`) | Передаёт в Heat Controller нажатие виджета одного места |
| Состояние индикации | Исходящий `STATE_SNAPSHOT` (`20002`) | Передаёт внешнему приложению фактическое состояние всех четырёх мест |

Остальные сообщения `HELLO`, `HELLO_ACK`, `COMMAND_RESULT`, `REQUEST_STATE` и
`BRIDGE_DISABLED` обслуживают подключение, подтверждение команды, повтор
состояния и жизненный цикл. Они не добавляют отдельные функции управления
нагревом.

С точки зрения разработчика внешнего приложения доступны четыре логические
команды нажатия. Все они используют один и тот же `what=20003` и различаются
только значением `seatId`:

| Логическая команда | `seatId` | Результат в Heat Controller |
|---|---|---|
| Нажать виджет переднего левого места | `fl` | Выполнить штатное переключение переднего левого нагревателя |
| Нажать виджет переднего правого места | `fr` | Выполнить штатное переключение переднего правого нагревателя |
| Нажать виджет заднего левого места | `rl` | Выполнить штатное переключение заднего левого нагревателя |
| Нажать виджет заднего правого места | `rr` | Выполнить штатное переключение заднего правого нагревателя |

Для каждого места Heat Controller сам выбирает корректное действие:

- в бинарном режиме нажатие переключает `OFF ↔ ON`;
- при двух активных уровнях нажатие переключает штатный цикл `0..2`;
- при трёх активных уровнях нажатие переключает штатный цикл `0..3`;
- порядок уровней берётся из настроек Heat Controller;
- результат всегда подтверждается новым фактическим `STATE_SNAPSHOT`.

Внешнее приложение не отправляет отдельные команды `SET_ON`, `SET_OFF`,
`SET_LEVEL`, `SET_POWER` или команды автоподогрева. Настройки режимов,
мощности, порядка уровней и автоподогрева остаются только в Heat Controller.

### 3.2. Минимальный обмен одного виджета

```text
1. Heat Controller → Client: STATE_SNAPSHOT
   fl: available=true, controlKind=cycle_2, activeLevel=0

2. Пользователь нажимает внешний виджет fl.

3. Client → Heat Controller: PRESS_SEAT
   apiVersion=1, requestId=42, seatId=fl

4. Heat Controller → Client: COMMAND_RESULT
   requestId=42, accepted=true, reason=accepted

5. Heat Controller → Client: STATE_SNAPSHOT
   fl: available=true, controlKind=cycle_2, activeLevel=1
```

`COMMAND_RESULT accepted=true` подтверждает только принятие нажатия. Виджет
обновляет окончательную индикацию по шагу 5 — фактическому snapshot.

### 3.3. Какие поля нужны виджету

Для отрисовки и доступности кнопки достаточно следующих полей snapshot:

| Поле | Для чего использовать |
|---|---|
| `connected` | Разрешать управление только при соединении Heat Controller с платой |
| `available` | Показывать, существует ли место, и включать/выключать нажатие |
| `controlKind` | Выбрать бинарную, двухуровневую или трёхуровневую индикацию |
| `activeLevelCount` | Определить количество активных уровней: `2` или `3` |
| `activeLevel` | Показать `0`/выключено либо текущий уровень `1..3` |
| `heating` | Показать общий признак активного нагрева |
| `actualPowerPercent` | При необходимости показать фактическую мощность |

Поле `autoActive` является только дополнительной read-only информацией. Внешний
виджет может его игнорировать: менять автоподогрев через API v1 нельзя.

## 4. Совместимость сборок

External Heat Bridge API v1 является единым контрактом для тестовой и релизной
сборок Heat Controller. Коды сообщений, ключи Bundle, правила авторизации и
поведение виджетов между сборками не меняются.

| Контур | Application ID | Назначение |
|---|---|---|
| Интеграционное тестирование | `com.dellreal.heatcontroller.debug` | Проверка внешнего приложения до выпуска интеграции |
| Релизное использование | `com.dellreal.heatcontroller` | Рабочее подключение после включения интеграции в Release |

На этапе интеграции разработчик подключается к Debug package. После успешной
приёмки тот же API v1 включается в Release без изменения протокола внешнего
приложения. Клиенту достаточно выбирать package установленного контура; имя
класса сервиса и весь Messenger-контракт остаются одинаковыми.

Android 4.3 (API 18) в область External Heat Bridge API v1 не входит.

## 5. Android endpoint

### 5.1. Идентификаторы

```text
test package:    com.dellreal.heatcontroller.debug
release package: com.dellreal.heatcontroller
service class:   com.dellreal.heatcontroller.integration.bridge.ExternalHeatBridgeService
exported:        true
intent action:   отсутствует
```

Подключение выполняется только явным `ComponentName`. У сервиса нет публичного
`intent-filter`, action или extras для выбора режима.

```kotlin
private val heatControllerPackage = "com.dellreal.heatcontroller.debug" // тестовый контур

private val bridgeComponent = ComponentName(
    heatControllerPackage,
    "com.dellreal.heatcontroller.integration.bridge.ExternalHeatBridgeService"
)

private val bridgeIntent = Intent().setComponent(bridgeComponent)
```

### 5.2. Подключение

```kotlin
private var remoteMessenger: Messenger? = null
private var bound = false

private val serviceConnection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName, binder: IBinder) {
        remoteMessenger = Messenger(binder)
        bound = true
        sendHello()
    }

    override fun onServiceDisconnected(name: ComponentName) {
        remoteMessenger = null
        bound = false
        scheduleRebind()
    }

    override fun onBindingDied(name: ComponentName) {
        remoteMessenger = null
        bound = false
        scheduleRebind()
    }

    override fun onNullBinding(name: ComponentName) {
        remoteMessenger = null
        bound = false
        scheduleRebind()
    }
}

fun bind(context: Context): Boolean {
    bound = context.bindService(
        bridgeIntent,
        serviceConnection,
        Context.BIND_AUTO_CREATE
    )
    return bound
}
```

`bindService()` создаёт транспортное соединение, но не регистрирует API-сессию.
После каждого `onServiceConnected()` клиент обязательно отправляет новый
`HELLO` со своим `replyTo`.

### 5.3. Канал ответов клиента

Клиент передаёт собственный `Messenger` в `Message.replyTo`. Все исходящие
сообщения Heat Controller приходят через этот объект.

```kotlin
private val incomingMessenger = Messenger(
    Handler(Looper.getMainLooper()) { message ->
        when (message.what) {
            20_001 -> handleHelloAck(message.data)
            20_002 -> handleStateSnapshot(message.data)
            20_004 -> handleCommandResult(message.data)
            20_006 -> handleBridgeDisabled(message.data)
        }
        true
    }
)
```

Не привязывайте обработку IPC непосредственно к View. Передавайте сообщения в
ViewModel, Store или другой слой состояния. Все `Bundle` следует проверять до
использования: клиент обязан безопасно переживать отсутствующее или неизвестное
поле будущей совместимой версии.

## 6. Авторизация и ограничения доступа

Перед подключением владелец Heat Controller должен открыть раздел интеграций и:

1. указать точный package name внешнего приложения;
2. включить «API стороннего приложения»;
3. при необходимости включить диагностический монитор.

Для каждого известного входящего сообщения Heat Controller получает Binder UID,
находит Android packages этого UID и разрешает запрос только при точном условии:

```text
packagesForUid(sendingUid) == setOf(configuredClientPackage)
```

Следствия:

- пустой настроенный package никого не авторизует;
- package клиента должен совпадать полностью, с учётом суффиксов сборки;
- UID с несколькими packages отклоняется, даже если один package совпал;
- сбой `PackageManager` приводит к безопасному отказу;
- одновременно регистрируется только один `replyTo`/Binder клиента;
- другой Binder получает `client_busy`, пока текущая сессия активна;
- при смерти Binder текущая сессия освобождается автоматически.

Сервис exported, но одной доступности Binder недостаточно: каждая известная
входящая команда проходит проверку UID/package до обработки payload.

## 7. Жизненный цикл сессии

Нормальный порядок обмена:

```text
Client                         Heat Controller
  │ bindService()                    │
  │─────────────────────────────────>│
  │ onServiceConnected(binder)       │
  │<─────────────────────────────────│
  │ HELLO + replyTo                  │
  │─────────────────────────────────>│
  │ HELLO_ACK                        │
  │<─────────────────────────────────│
  │ STATE_SNAPSHOT                   │
  │<─────────────────────────────────│
  │ PRESS_SEAT                       │
  │─────────────────────────────────>│
  │ COMMAND_RESULT                   │
  │<─────────────────────────────────│
  │ STATE_SNAPSHOT при изменении     │
  │<─────────────────────────────────│
```

Правила:

1. `HELLO` отправляется после каждого нового Binder-подключения.
2. Успешный `HELLO` всегда приводит сначала к `HELLO_ACK`, затем к полному
   `STATE_SNAPSHOT`.
3. Heat Controller публикует новый snapshot при изменении нормализованного
   состояния или признака соединения.
4. `REQUEST_STATE` повторяет последний сохранённый snapshot. Если его ещё нет,
   Heat Controller формирует новый.
5. Обычный unbind, остановка процесса или смерть Binder не означают
   `BRIDGE_DISABLED`; клиент просто подключается заново.
6. `BRIDGE_DISABLED` отправляется, когда API явно выключен владельцем.
7. Изменение разрешённого package завершает текущую сессию. Подключённый клиент
   может перед отключением получить `COMMAND_RESULT` с `requestId=0` и
   `reason="unauthorized"`.

После Binder death рекомендуется переподключаться с ограниченной задержкой,
например две секунды. Не создавайте несколько параллельных циклов rebind.

## 8. Общие правила payload

- Payload передаётся в `Message.data` как Android `Bundle`.
- Используются только `Int`, `Long`, `Boolean`, `String` и вложенный `Bundle`.
- JSON в External Heat Bridge API не используется.
- Имена ключей чувствительны к регистру.
- Числа передаются как указанный тип; не заменяйте `Long` строкой или `Int`.
- `replyTo` — поле `Message`, а не ключ внутри `Bundle`.
- Клиент должен игнорировать неизвестные ключи в исходящих сообщениях.
- Клиент не должен полагаться на порядок ключей внутри `Bundle`.

## 9. Входящие сообщения

### 9.1. `HELLO` — `what=20000`

Назначение: согласовать поддерживаемую версию и зарегистрировать канал ответов.

```kotlin
private fun sendHello() {
    remoteMessenger?.send(Message.obtain(null, 20_000).apply {
        data = Bundle().apply {
            putInt("apiMin", 1)
            putInt("apiMax", 1)
            putString("clientName", context.packageName)
        }
        replyTo = incomingMessenger
    })
}
```

| Поле | Тип | Обязательное | Правило |
|---|---|---:|---|
| `apiMin` | `Int` | Да | Минимальная версия API, поддерживаемая клиентом |
| `apiMax` | `Int` | Да | Максимальная версия API, поддерживаемая клиентом |
| `clientName` | `String` | Да | Печатный ASCII от `0x20` до `0x7E`, не более 64 символов |
| `replyTo` | `Messenger` | Да | Binder-канал для всех ответов и snapshot |

Дополнительные условия:

- `apiMin` не может быть больше `apiMax`;
- диапазон `apiMin..apiMax` должен содержать версию `1`;
- `clientName` предназначен для диагностики и не заменяет авторизацию по UID;
- повторный `HELLO` с тем же Binder допустим и повторяет `HELLO_ACK` и snapshot;
- `HELLO` с другим Binder при занятой сессии получает `client_busy`.

Ошибки возвращаются через `COMMAND_RESULT` с `requestId=0`:

| Условие | `reason` |
|---|---|
| API выключен | `disabled` |
| UID/package не разрешён | `unauthorized` |
| Нет обязательного поля или неверный тип/диапазон | `invalid_request` |
| Диапазон версий не содержит `1` | `unsupported_version` |
| Уже зарегистрирован другой Binder | `client_busy` |

Если `replyTo` отсутствует, Heat Controller не имеет канала для ответа и не
создаёт клиентскую сессию.

### 9.2. `PRESS_SEAT` — `what=20003`

Назначение: выполнить одно штатное нажатие кнопки выбранного места.

```kotlin
fun pressSeat(seatId: String, requestId: Long) {
    remoteMessenger?.send(Message.obtain(null, 20_003).apply {
        data = Bundle().apply {
            putInt("apiVersion", 1)
            putLong("requestId", requestId)
            putString("seatId", seatId)
        }
        replyTo = incomingMessenger
    })
}
```

| Поле | Тип | Обязательное | Правило |
|---|---|---:|---|
| `apiVersion` | `Int` | Да | Ровно `1` |
| `requestId` | `Long` | Да | Идентификатор, выбранный клиентом |
| `seatId` | `String` | Да | Одно из `fl`, `fr`, `rl`, `rr` |
| `replyTo` | `Messenger` | Да | Тот же Binder, который зарегистрирован через `HELLO` |

Обозначения мест:

| `seatId` | Место |
|---|---|
| `fl` | переднее левое |
| `fr` | переднее правое |
| `rl` | заднее левое |
| `rr` | заднее правое |

Команда вызывает тот же штатный цикл, что кнопка Heat Controller:

- `binary`: `OFF → ON → OFF`;
- `cycle_2`: переключение между `0..2` по настроенному порядку уровней;
- `cycle_3`: переключение между `0..3` по настроенному порядку уровней.

Клиент не указывает целевой уровень. Следующее состояние определяет Heat
Controller с учётом режима места, текущего состояния и настройки порядка
уровней.

Ограничение частоты действует отдельно для каждого `seatId`: два успешно
маршрутизируемых нажатия одного места должны быть разделены минимум `250 мс`.
Нажатие другого места не блокируется этим интервалом.

На каждый корректно декодированный запрос Heat Controller возвращает
`COMMAND_RESULT`, сохраняя исходный `requestId`. Ошибка, возникшая до чтения
`requestId`, может вернуть служебное значение `0`.

### 9.3. `REQUEST_STATE` — `what=20005`

Назначение: получить повтор последнего полного состояния.

Минимальный запрос:

```kotlin
fun requestState() {
    remoteMessenger?.send(Message.obtain(null, 20_005).apply {
        replyTo = incomingMessenger
    })
}
```

Допустимый версионированный запрос:

```kotlin
Message.obtain(null, 20_005).apply {
    data = Bundle().apply { putInt("apiVersion", 1) }
    replyTo = incomingMessenger
}
```

| Поле | Тип | Обязательное | Правило |
|---|---|---:|---|
| `apiVersion` | `Int` | Нет | Если присутствует, должно быть равно `1` |
| `replyTo` | `Messenger` | Да | Тот же Binder, который зарегистрирован через `HELLO` |

Успешный ответ — `STATE_SNAPSHOT`. Отдельный `COMMAND_RESULT` при успехе не
отправляется.

Если сохранённый snapshot уже существует, он может прийти с прежними
`sequence` и `timestampEpochMillis`. Это корректный повтор, а не новое изменение
состояния.

Ошибки:

| Условие | Ответ |
|---|---|
| API выключен | `COMMAND_RESULT`, `disabled` |
| `apiVersion` присутствует, но не равен `1` или имеет неверный тип | `COMMAND_RESULT`, `unsupported_version` |
| Нет активной сессии или `replyTo` не совпадает | `COMMAND_RESULT`, `invalid_request` |

## 10. Исходящие сообщения

### 10.1. `HELLO_ACK` — `what=20001`

Назначение: подтвердить выбранную версию и набор возможностей.

| Поле | Тип | Значение v1 |
|---|---|---|
| `apiVersion` | `Int` | `1` |
| `capabilities` | `String` | `state_snapshot,press_seat` |
| `servicePackage` | `String` | Package текущего контура: `com.dellreal.heatcontroller.debug` или `com.dellreal.heatcontroller` |

`capabilities` — строка со значениями через запятую. Клиент должен разбирать её
как множество токенов и игнорировать неизвестные будущие возможности.

Получение `HELLO_ACK` означает, что сессия зарегистрирована. Сразу после него
Heat Controller отправляет `STATE_SNAPSHOT`.

### 10.2. `STATE_SNAPSHOT` — `what=20002`

Назначение: передать полный снимок соединения и всех четырёх мест.

Snapshot никогда не является delta. Верхний Bundle всегда содержит `fl`, `fr`,
`rl` и `rr`, даже если некоторые места недоступны.

| Поле | Тип | Описание |
|---|---|---|
| `apiVersion` | `Int` | Версия payload, `1` |
| `sequence` | `Long` | Номер сформированного snapshot в текущем процессе Heat Controller |
| `timestampEpochMillis` | `Long` | Время формирования в Unix epoch milliseconds |
| `connected` | `Boolean` | Есть ли у Heat Controller активное соединение с платой |
| `fl` | `Bundle` | Полное состояние переднего левого места |
| `fr` | `Bundle` | Полное состояние переднего правого места |
| `rl` | `Bundle` | Полное состояние заднего левого места |
| `rr` | `Bundle` | Полное состояние заднего правого места |

`sequence` монотонно увеличивается при формировании новых snapshot в пределах
текущего процесса Heat Controller. После перезапуска процесса отсчёт начинается
заново. Повтор, отправленный по `REQUEST_STATE`, может сохранить тот же номер.

#### Bundle места

| Поле | Тип | Допустимые значения | Значение |
|---|---|---|---|
| `seatId` | `String` | `fl`, `fr`, `rl`, `rr` | Идентификатор места |
| `available` | `Boolean` | `true`, `false` | Место присутствует и доступно для управления |
| `heating` | `Boolean` | `true`, `false` | Нагрев фактически активен по нормализованному состоянию |
| `controlKind` | `String` | `binary`, `cycle_2`, `cycle_3` | Тип пользовательского управления |
| `activeLevelCount` | `Int` | `2` или `3` | Число активных ступеней пользовательского цикла |
| `activeLevel` | `Int` | `0..activeLevelCount` | Текущая пользовательская ступень; `0` означает выключено |
| `actualPowerPercent` | `Int` | `0..100` | Фактическая мощность в процентах |
| `autoActive` | `Boolean` | `true`, `false` | Сейчас активен автоподогрев |

Правила интерпретации:

- при `available=false` клиент отключает кнопку управления;
- для недоступного места `heating=false`, `activeLevel=0`,
  `actualPowerPercent=0`, `autoActive=false`;
- при `connected=false` клиент должен считать управление временно
  недоступным, даже если последний seat Bundle ещё содержит состояние;
- `binary` отображается как `OFF/ON`, а `activeLevel` равен `0` или `1`;
- `cycle_2` отображает ступени `0..2`;
- `cycle_3` отображает ступени `0..3`;
- `activeLevelCount` всегда присутствует; значение `3` используется как
  безопасное совместимое значение, если контроллер не сообщил корректные `2`
  или `3`;
- `actualPowerPercent` — реальная мощность, а не номер ступени;
- `autoActive=true` в v1 является только информацией: отдельной команды
  управления автоподогревом нет;
- клиент не вычисляет следующий уровень самостоятельно и не применяет
  оптимистическое состояние как окончательное.

Рекомендуемый порядок обработки:

1. проверить `apiVersion`;
2. сравнить `sequence` с последним принятым в текущей Binder-сессии;
3. заменить весь локальный снимок, а не объединять его как delta;
4. обновить UI из новой модели состояния;
5. при новом Binder-сеансе сбросить предположения о предыдущей
   последовательности.

### 10.3. `COMMAND_RESULT` — `what=20004`

Назначение: сообщить результат проверки и маршрутизации входящей команды.

| Поле | Тип | Описание |
|---|---|---|
| `apiVersion` | `Int` | Версия ответа, `1` |
| `requestId` | `Long` | Идентификатор исходного запроса или `0` для служебной/недекодированной ошибки |
| `accepted` | `Boolean` | Команда прошла проверки и передана штатной логике |
| `reason` | `String` | Стабильный машинный код результата |

`accepted=true` не является подтверждением физического изменения нагрева. Это
означает только, что команда принята и штатное действие вызвано. Источник истины
для интерфейса — последующий `STATE_SNAPSHOT`.

В v1 нет поля, которое связывает конкретный snapshot с `requestId`. Клиент
должен дождаться фактического состояния и применять разумный тайм-аут интерфейса,
не отправляя бесконечные автоматические повторы.

#### Коды `reason`

| `reason` | `accepted` | Значение | Рекомендуемое действие клиента |
|---|---:|---|---|
| `accepted` | `true` | Команда передана штатной логике | Ждать `STATE_SNAPSHOT` |
| `disabled` | `false` | API выключен владельцем | Отключить управление, не спамить rebind |
| `unauthorized` | `false` | UID/package не совпадает | Показать ошибку настройки package |
| `unsupported_version` | `false` | Версия не поддерживается | Прекратить обмен до обновления одной из сторон |
| `client_busy` | `false` | Уже зарегистрирован другой Binder | Закрыть дублирующую сессию и повторить позже |
| `invalid_request` | `false` | Неверный payload, сессия или `replyTo` | Исправить клиент; автоматический повтор не поможет |
| `invalid_seat` | `false` | Неизвестный `seatId` | Исправить идентификатор |
| `not_connected` | `false` | Heat Controller не соединён с платой | Отключить управление до `connected=true` |
| `seat_unavailable` | `false` | Место отсутствует или недоступно | Отключить кнопку этого места |
| `rate_limited` | `false` | Повтор одного места раньше 250 мс | Дождаться разрешённого интервала |
| `internal_error` | `false` | Штатное действие завершилось исключением | Показать временную ошибку, дождаться состояния |

Клиент должен безопасно обрабатывать неизвестный будущий `reason` как общий
отказ без автоматического частого повтора.

### 10.4. `BRIDGE_DISABLED` — `what=20006`

Назначение: уведомить активного клиента, что владелец явно выключил API.

| Поле | Тип | Значение v1 |
|---|---|---|
| `apiVersion` | `Int` | `1` |
| `reason` | `String` | `disabled` |

После получения:

1. немедленно отключите все команды управления;
2. сбросьте состояние зарегистрированной API-сессии;
3. выполните обычный `unbindService()`;
4. предложите пользователю проверить настройку в Heat Controller;
5. не запускайте агрессивный автоматический rebind, пока API не будет включён.

`BRIDGE_DISABLED` не гарантируется при аварийной остановке процесса, Binder
death, удалении APK или обычном unbind. Эти случаи определяются через Android
`ServiceConnection` и Binder death.

## 11. Модель состояния клиента

Рекомендуемые состояния адаптера:

| Состояние | Условие |
|---|---|
| `UNAVAILABLE` | Совместимый service отсутствует или bind невозможен |
| `BINDING` | Выполняется `bindService()` |
| `NEGOTIATING` | Binder получен, отправлен `HELLO`, ожидается `HELLO_ACK` |
| `READY_DISCONNECTED` | Сессия активна, snapshot имеет `connected=false` |
| `READY` | Сессия активна, snapshot имеет `connected=true` |
| `DISABLED` | Получен `BRIDGE_DISABLED` или `reason=disabled` |
| `UNAUTHORIZED` | Получен `reason=unauthorized` |
| `INCOMPATIBLE` | Получен `reason=unsupported_version` |

UI конкретного места строится только из последнего snapshot:

```kotlin
val controlsEnabled = sessionReady && snapshot.connected && seat.available
val displayedLevel = seat.activeLevel
val displayedPower = seat.actualPowerPercent
```

После отправки `PRESS_SEAT` допустимо показать индикатор ожидания, но нельзя
безусловно менять `activeLevel` локально. Ожидание завершается после получения
нового фактического snapshot либо по тайм-ауту UI.

## 12. Обработка ошибок транспорта

Клиент должен обрабатывать:

- `bindService()` вернул `false`;
- `SecurityException` или другой runtime-сбой bind;
- `RemoteException` при `Messenger.send()`;
- `onServiceDisconnected()`;
- `onBindingDied()`;
- `onNullBinding()`;
- Binder death через `linkToDeath`;
- перезапуск Heat Controller;
- отсутствие совместимой сборки Heat Controller;
- повторный snapshot с тем же `sequence`;
- неизвестные поля, `reason` или `capabilities`.

После потери Binder:

1. очистите `remoteMessenger`;
2. отмените ожидающие локальные операции;
3. пометьте управление недоступным;
4. выполните один управляемый rebind с задержкой;
5. после подключения обязательно повторите `HELLO`;
6. дождитесь нового `HELLO_ACK` и полного snapshot.

## 13. Минимальный клиент

```kotlin
class ExternalHeatBridgeClient(
    private val context: Context,
    private val heatControllerPackage: String,
    private val onMessage: (Message) -> Unit
) {
    private val handler = Handler(Looper.getMainLooper())
    private val incoming = Messenger(Handler(Looper.getMainLooper()) { message ->
        when (message.what) {
            20_001, 20_002, 20_004, 20_006 -> onMessage(message)
        }
        true
    })

    private var remote: Messenger? = null
    private var bound = false

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            remote = Messenger(binder)
            bound = true
            send(Message.obtain(null, 20_000).apply {
                data = Bundle().apply {
                    putInt("apiMin", 1)
                    putInt("apiMax", 1)
                    putString("clientName", context.packageName)
                }
                replyTo = incoming
            })
        }

        override fun onServiceDisconnected(name: ComponentName) {
            // Binding остаётся зарегистрированным; Android может восстановить сервис.
            remote = null
        }

        override fun onBindingDied(name: ComponentName) {
            releaseBinding()
            // Запланировать один новый bind с backoff.
        }

        override fun onNullBinding(name: ComponentName) {
            releaseBinding()
        }
    }

    fun bind(): Boolean = runCatching {
        context.bindService(
            Intent().setComponent(
                ComponentName(
                    heatControllerPackage,
                    "com.dellreal.heatcontroller.integration.bridge.ExternalHeatBridgeService"
                )
            ),
            connection,
            Context.BIND_AUTO_CREATE
        ).also { bound = it }
    }.getOrDefault(false)

    fun pressSeat(seatId: String, requestId: Long) {
        send(Message.obtain(null, 20_003).apply {
            data = Bundle().apply {
                putInt("apiVersion", 1)
                putLong("requestId", requestId)
                putString("seatId", seatId)
            }
            replyTo = incoming
        })
    }

    fun requestState() {
        send(Message.obtain(null, 20_005).apply {
            data = Bundle().apply { putInt("apiVersion", 1) }
            replyTo = incoming
        })
    }

    fun unbind() {
        releaseBinding()
    }

    private fun send(message: Message) {
        try {
            remote?.send(message)
        } catch (_: RemoteException) {
            remote = null
            // Дождаться callback Android или запланировать восстановление с backoff.
        }
    }

    private fun releaseBinding() {
        if (bound) runCatching { context.unbindService(connection) }
        remote = null
        bound = false
    }
}
```

Это минимальная основа, а не готовая lifecycle-библиотека. В production-клиенте
добавьте контролируемый rebind, Binder death, отмену повторов, валидацию payload,
хранилище snapshot и привязку к lifecycle приложения или foreground service.

## 14. Диагностический монитор

Монитор Heat Controller помогает проследить IPC и последующее штатное действие,
но его текст не является частью API и не должен парситься клиентом.

Типичный успешный обмен:

```text
CLIENT→HC API what=20003 {apiVersion=1,requestId=42,seatId=fl}
HC→CLIENT API what=20004 {apiVersion=1,requestId=42,accepted=true,reason=accepted}
HC→CLIENT API what=20002 {sequence=18,connected=true,...}
```

Диагностика:

| Симптом | Вероятная граница ошибки |
|---|---|
| Нет входящего `what=20000` | explicit bind, ComponentName или отправка `HELLO` |
| `unauthorized` | настроенный package не совпадает с package UID клиента |
| `client_busy` | существует другая Binder-сессия |
| Есть `COMMAND_RESULT`, но нет нового состояния | команда отклонена ниже IPC или физическое состояние не изменилось |
| Snapshot приходит, UI не меняется | ошибка модели состояния внешнего приложения |
| После перезапуска нет сообщений | клиент не выполнил повторный bind и `HELLO` |

## 15. Правила версионирования

Версия v1 фиксирует:

- диапазон `Message.what` `20000–20006`;
- обязательные ключи и их Android-типы;
- значения `seatId`, `controlKind` и `reason`;
- смысл `accepted`, snapshot и направления сообщений;
- одну управляющую возможность `press_seat`.

Совместимые изменения v1 могут добавлять:

- необязательные ключи в исходящие Bundle;
- новые capability-токены;
- новые машинные причины отказа;
- новые исходящие уведомления с новыми `what`, если старый клиент может их
  безопасно игнорировать.

Новая major-версия потребуется, если изменятся тип или смысл существующего
поля, обязательный порядок обмена, семантика команды либо будет удалено
существующее сообщение. Клиент должен отправлять реальный диапазон
`apiMin..apiMax`, а не всегда объявлять поддержку неизвестных версий.

## 16. Контрольный список интеграции

Интеграция считается корректной, если на реальном головном устройстве проверено:

- установлен совместимый Android 9+ APK Heat Controller;
- в настройках указан точный package клиента и включён внешний API;
- explicit bind возвращает Binder;
- `HELLO` получает `HELLO_ACK` версии `1`;
- после ACK приходит полный snapshot с `fl`, `fr`, `rl`, `rr`;
- корректно отображаются `binary`, `cycle_2` и `cycle_3`;
- `activeLevelCount=2` ограничивает UI двумя активными ступенями;
- недоступное место блокирует управление;
- `connected=false` блокирует управление;
- `PRESS_SEAT` возвращает тот же `requestId`;
- UI подтверждает изменение по snapshot, а не по одному `accepted=true`;
- повтор одного места раньше 250 мс получает `rate_limited`;
- другое место не блокируется лимитом первого;
- `REQUEST_STATE` повторяет полный snapshot;
- перезапуск клиента приводит к новому bind и `HELLO`;
- Binder death корректно переводит UI в недоступное состояние;
- выключение API приводит к `BRIDGE_DISABLED`;
- неверный package получает `unauthorized`;
- один и тот же сценарий клиента работает с тестовым и релизным package без
  изменения кодов сообщений или payload;
- клиент не использует внутренний протокол платы или текст монитора как API.

## 17. Краткая памятка

```text
Endpoint:
  test:    com.dellreal.heatcontroller.debug/
  release: com.dellreal.heatcontroller/
  com.dellreal.heatcontroller.integration.bridge.ExternalHeatBridgeService

Transport:
  explicit bindService + Messenger + Bundle

Version:
  1

Functional widget command, Client → Heat Controller:
  20003 PRESS_SEAT (seatId=fl|fr|rl|rr)

Functional widget state, Heat Controller → Client:
  20002 STATE_SNAPSHOT

Service messages:
  20000 HELLO             Client → Heat Controller
  20001 HELLO_ACK         Heat Controller → Client
  20004 COMMAND_RESULT    Heat Controller → Client
  20005 REQUEST_STATE     Client → Heat Controller
  20006 BRIDGE_DISABLED   Heat Controller → Client

Public control capability:
  press_seat only

Seats:
  fl, fr, rl, rr

Control kinds:
  binary, cycle_2, cycle_3
```
