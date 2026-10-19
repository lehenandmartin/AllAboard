import { createContext, useContext, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { computeBoardLayout } from '../../core/boardLayout'
import { formatDecimal } from '../../core/format'
import { MAX_LETTERBOX_PERCENT, letterboxPercentFor, visibleAspect } from '../../core/letterbox'
import { MAX_MENTION_BAND_PERCENT, MAX_MENTION_OFFSET_PERCENT, mentionFontSize } from '../../core/mention'
import { countOverrides, isOverridden, resolveSettings } from '../../core/settings'
import type {
  BoardSettings,
  CompositeSettingKey,
  Count,
  FrameRatioSetting,
  ImageFit,
  LastRowAlign,
  Margins,
  Mention,
  MentionPlacement,
  SafeFont,
  TextAlign,
  TextMode,
} from '../../core/types'
import { SAFE_FONTS } from '../../core/types'
import type { SlideFormatId } from '../../core/units'
import type { Messages } from '../../i18n'
import { useT } from '../../i18n'
import { useActiveBoard, useProjectStore } from '../../store/projectStore'
import { Icon } from '../Icon/Icon'
import type { IconName } from '../Icon/icons'
import { CmInput, ColorInput, NumberInput, Section, Segmented, Select, Toggle } from './fields'
import './SettingsPanel.css'

type Scope = 'board' | 'project'

/** Link between the fields and the settings: the active board's, or the project defaults. */
interface Binding {
  scope: Scope
  values: BoardSettings
  set: <K extends keyof BoardSettings>(key: K, value: BoardSettings[K]) => void
  /** Changes a single field of a composite setting (the others stay inherited). */
  setField: <K extends CompositeSettingKey, F extends keyof BoardSettings[K]>(
    key: K,
    field: F,
    value: BoardSettings[K][F],
  ) => void
  /** Without a field, for a composite setting: at least one of its fields. */
  isOverridden: (key: keyof BoardSettings, field?: string) => boolean
  reset: (key: keyof BoardSettings, field?: string) => void
}

const BindingContext = createContext<Binding | null>(null)

function useBinding(): Binding {
  const binding = useContext(BindingContext)
  if (!binding) throw new Error('useBinding outside SettingsPanel')
  return binding
}

/** A setting row: label, control, and override mark with back-to-default. */
function Setting({
  k,
  label,
  children,
  field,
  htmlFor,
  stacked = false,
  hideOverride = false,
}: {
  k: keyof BoardSettings
  /** Field of a composite setting shown by this row (the dot and the reset only target it). */
  field?: string
  label: string
  children: ReactNode
  htmlFor?: string
  /** Label above the control, which spans the full width (choices with icons). */
  stacked?: boolean
  /** The override is already flagged elsewhere (section header). */
  hideOverride?: boolean
}) {
  const { isOverridden, reset } = useBinding()
  const { common } = useT()
  const overridden = !hideOverride && isOverridden(k, field)
  const className = ['setting', overridden && 'setting--overridden', stacked && 'setting--stacked']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={className}>
      <label className="setting__label" htmlFor={htmlFor}>
        {label}
        {overridden && <span className="setting__dot" title={common.overridden} />}
      </label>
      <div className="setting__control">{children}</div>
      {overridden ? (
        <button
          type="button"
          className="setting__reset"
          onClick={() => reset(k, field)}
          title={common.resetToProject}
          aria-label={common.resetToProjectFor(label)}
        >
          <Icon name="arrow-reset" size={16} />
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

type SettingsTexts = Messages['settings']

const slideFormatOptions = (texts: Messages): { value: SlideFormatId; label: string }[] =>
  (['16:9', '4:3', 'a4-landscape', 'a4-portrait', 'custom'] as const).map((value) => ({
    value,
    label: texts.slideFormats[value],
  }))

const ratioOptions = (s: SettingsTexts): { value: FrameRatioSetting; label: string }[] => [
  { value: '16:9', label: '16:9' },
  { value: '1:1', label: '1:1' },
  { value: '9:16', label: '9:16' },
  { value: '4:5', label: '4:5' },
  { value: '4:3', label: '4:3' },
  { value: '2.39:1', label: s.ratioScope },
  { value: 'custom', label: s.ratioCustom },
  { value: 'firstImage', label: s.ratioFirstImage },
]

const fitOptions = (s: SettingsTexts): { value: ImageFit; label: ReactNode; title: string }[] => [
  {
    value: 'cover',
    label: (
      <>
        <Icon name="scale-fill" size={16} />
        {s.fill}
      </>
    ),
    title: s.fillTitle,
  },
  {
    value: 'contain',
    label: (
      <>
        <Icon name="scale-fit" size={16} />
        {s.contain}
      </>
    ),
    title: s.containTitle,
  },
]

const lastRowOptions = (s: SettingsTexts): { value: LastRowAlign; label: ReactNode; title: string }[] => [
  {
    value: 'left',
    label: (
      <>
        <Icon name="align-left" size={16} />
        {s.left}
      </>
    ),
    title: s.leftTitle,
  },
  {
    value: 'center',
    label: (
      <>
        <Icon name="align-center-vertical" size={16} />
        {s.centered}
      </>
    ),
    title: s.centeredTitle,
  },
]

const textModeOptions = (s: SettingsTexts): { value: Exclude<TextMode, 'none'>; label: string; title: string }[] => [
  { value: 'perImage', label: s.perImage, title: s.perImageTitle },
  { value: 'perRow', label: s.perRow, title: s.perRowTitle },
]

const alignOptions = (s: SettingsTexts): { value: TextAlign; label: ReactNode; title: string }[] => [
  { value: 'left', label: <Icon name="text-align-left" size={16} />, title: s.alignLeft },
  { value: 'center', label: <Icon name="text-align-center" size={16} />, title: s.alignCenter },
  { value: 'right', label: <Icon name="text-align-right" size={16} />, title: s.alignRight },
]

function CountInput({ k, label }: { k: 'columns' | 'rows'; label: string }) {
  const { values, set } = useBinding()
  const { common } = useT()
  const id = useId()
  const value: Count = values[k]
  return (
    <Setting k={k} label={label} htmlFor={id}>
      <NumberInput
        id={id}
        value={value === 'auto' ? null : value}
        onChange={(v) => set(k, v === null ? 'auto' : v)}
        min={1}
        max={50}
        integer
        allowEmpty
        placeholder={common.auto}
      />
      {value !== 'auto' && (
        <button type="button" className="link-button" onClick={() => set(k, 'auto')}>
          {common.auto}
        </button>
      )}
    </Setting>
  )
}

function CmSetting({
  k,
  label,
  max,
}: {
  k: 'gutterH' | 'gutterV' | 'titleHeight' | 'textHeight' | 'textGap'
  label: string
  max?: number
}) {
  const { values, set } = useBinding()
  const id = useId()
  return (
    <Setting k={k} label={label} htmlFor={id}>
      <CmInput id={id} value={values[k]} onChange={(v) => set(k, v)} max={max} />
    </Setting>
  )
}

function MarginsSetting() {
  const { values, setField } = useBinding()
  const { settings: s } = useT()
  const sides: (keyof Margins)[] = ['top', 'bottom', 'left', 'right']
  return (
    <Setting k="margins" label={s.margins}>
      <div className="margins-grid">
        {sides.map((side) => (
          <label key={side} className="margins-grid__item">
            <span>{s.marginSides[side]}</span>
            <CmInput
              value={values.margins[side]}
              onChange={(v) => setField('margins', side, v)}
              ariaLabel={s.marginLabel(s.marginSides[side])}
            />
          </label>
        ))}
      </div>
    </Setting>
  )
}

function GridSection() {
  const { values, set } = useBinding()
  const { settings: s } = useT()
  const ratioId = useId()
  const customId = useId()
  return (
    <Section id="grid" title={s.grid} icon="layout-cell-four">
      <CountInput k="columns" label={s.columns} />
      <CountInput k="rows" label={s.rows} />
      <Setting k="frameRatio" label={s.frameRatio} htmlFor={ratioId}>
        <Select
          id={ratioId}
          value={values.frameRatio}
          options={ratioOptions(s)}
          onChange={(v) => set('frameRatio', v)}
        />
      </Setting>
      {values.frameRatio === 'custom' && (
        <Setting k="customRatio" label={s.widthOverHeight} htmlFor={customId}>
          <NumberInput
            id={customId}
            value={values.customRatio}
            onChange={(v) => v !== null && set('customRatio', v)}
            min={0.1}
            max={10}
            step={0.01}
            decimals={3}
          />
        </Setting>
      )}
      <Setting k="fit" label={s.image} stacked>
        <Segmented
          ariaLabel={s.imageFit}
          value={values.fit}
          options={fitOptions(s)}
          onChange={(v) => set('fit', v)}
        />
      </Setting>
      <Setting k="lastRowAlign" label={s.lastRow} stacked>
        <Segmented
          ariaLabel={s.lastRowAlign}
          value={values.lastRowAlign}
          options={lastRowOptions(s)}
          onChange={(v) => set('lastRowAlign', v)}
        />
      </Setting>
    </Section>
  )
}

function SpacingSection() {
  const { settings: s } = useT()
  return (
    <Section id="spacing" title={s.spacing} icon="auto-fit-width">
      <MarginsSetting />
      <CmSetting k="gutterH" label={s.gutterH} />
      <CmSetting k="gutterV" label={s.gutterV} />
    </Section>
  )
}

/**
 * Section of an optional feature: the switch is in the header, and the
 * settings only show when the option is on.
 */
function OptionSection({
  title,
  icon,
  k,
  field,
  isOn,
  onChange,
  children,
}: {
  title: string
  icon: IconName
  /** Setting (and field) that holds the switch: its dot and reset show in the header. */
  k: keyof BoardSettings
  field?: string
  /** Is the option on, according to these settings? */
  isOn: (settings: BoardSettings) => boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
}) {
  const { scope, values, isOverridden, reset } = useBinding()
  const { common } = useT()
  const defaults = useProjectStore((s) => s.project.defaults)
  const checked = isOn(values)
  const overridden = isOverridden(k, field)
  // Going back to the project's state (on then off) clears the override
  // instead of keeping one identical to the default.
  const toggle = (on: boolean) =>
    scope === 'board' && on === isOn(defaults) ? reset(k, field) : onChange(on)
  return (
    <section className={checked ? 'settings-section option-section' : 'settings-section option-section option-section--off'}>
      <div className="option-section__header">
        <h3 className="option-section__title">
          <Icon name={icon} size={16} className="settings-section__icon" />
          {title}
          {overridden && <span className="setting__dot" title={common.overridden} />}
        </h3>
        {overridden && (
          <button
            type="button"
            className="setting__reset"
            onClick={() => reset(k, field)}
            title={common.resetToProject}
            aria-label={common.resetToProjectFor(title)}
          >
            <Icon name="arrow-reset" size={16} />
          </button>
        )}
        <Toggle label={title} checked={checked} onChange={toggle} />
      </div>
      {checked && children && <div className="settings-section__body">{children}</div>}
    </section>
  )
}

function TitleSection() {
  const { scope, set } = useBinding()
  const { settings: s } = useT()
  const board = useActiveBoard()
  const setBoardTitle = useProjectStore((s) => s.setBoardTitle)
  const textId = useId()
  return (
    <OptionSection
      title={s.titleSection}
      icon="text-header-1"
      k="titleEnabled"
      isOn={(s) => s.titleEnabled}
      onChange={(v) => set('titleEnabled', v)}
    >
      <CmSetting k="titleHeight" label={s.height} />
      {scope === 'board' && (
        <div className="setting">
          <label className="setting__label" htmlFor={textId}>
            {s.text}
          </label>
          <div className="setting__control">
            <input
              id={textId}
              className="text-input"
              type="text"
              value={board.title}
              placeholder={s.titlePlaceholder}
              onChange={(e) => setBoardTitle(board.id, e.target.value)}
            />
          </div>
          <span />
        </div>
      )}
    </OptionSection>
  )
}

function TextSection() {
  const { values, set, setField } = useBinding()
  const { settings: s } = useT()
  const sizeId = useId()
  return (
    <OptionSection
      title={s.textSection}
      icon="text-description"
      k="textMode"
      isOn={(s) => s.textMode !== 'none'}
      onChange={(on) => set('textMode', on ? 'perImage' : 'none')}
    >
      <Setting k="textMode" label={s.position} stacked hideOverride>
        <Segmented
          ariaLabel={s.textPosition}
          value={values.textMode === 'perRow' ? 'perRow' : 'perImage'}
          options={textModeOptions(s)}
          onChange={(v) => set('textMode', v)}
        />
      </Setting>
      <CmSetting k="textHeight" label={s.blockHeight} />
      <CmSetting k="textGap" label={s.gap} />
      <Setting k="textStyle" field="fontSize" label={s.fontSize} htmlFor={sizeId}>
        <NumberInput
          id={sizeId}
          value={values.textStyle.fontSize}
          onChange={(v) => v !== null && setField('textStyle', 'fontSize', v)}
          min={4}
          max={96}
          step={1}
          decimals={1}
          suffix="pt"
        />
      </Setting>
      <Setting k="textStyle" field="align" label={s.alignment}>
        <Segmented
          ariaLabel={s.textAlignment}
          value={values.textStyle.align}
          options={alignOptions(s)}
          onChange={(align) => setField('textStyle', 'align', align)}
        />
      </Setting>
      <Setting k="textStyle" field="color" label={s.color}>
        <ColorInput
          ariaLabel={s.textColor}
          value={values.textStyle.color}
          onChange={(color) => setField('textStyle', 'color', color)}
        />
      </Setting>
    </OptionSection>
  )
}

function NumberingSection() {
  const { scope, values, setField } = useBinding()
  const { settings: s, common } = useT()
  const prefixId = useId()
  const digitsId = useId()
  return (
    <OptionSection
      title={s.numbering}
      icon="number-symbol"
      k="numbering"
      field="enabled"
      isOn={(s) => s.numbering.enabled}
      onChange={(enabled) => setField('numbering', 'enabled', enabled)}
    >
      <Setting k="numbering" field="prefix" label={s.prefix} htmlFor={prefixId}>
        <input
          id={prefixId}
          className="text-input"
          type="text"
          value={values.numbering.prefix}
          placeholder={common.none}
          onChange={(e) => setField('numbering', 'prefix', e.target.value)}
        />
      </Setting>
      <Setting k="numbering" field="digits" label={s.digits} htmlFor={digitsId}>
        <NumberInput
          id={digitsId}
          value={values.numbering.digits}
          onChange={(v) => v !== null && setField('numbering', 'digits', v)}
          min={1}
          max={4}
          integer
        />
      </Setting>
      <p className="settings-hint">
        {scope === 'project'
          ? s.numberingProject
          : values.textMode === 'perImage'
            ? s.numberingPerImage
            : s.numberingOnImage}
      </p>
    </OptionSection>
  )
}

function BorderSection() {
  const { values, setField } = useBinding()
  const { settings: s } = useT()
  const widthId = useId()
  return (
    <OptionSection
      title={s.border}
      icon="image-border"
      k="border"
      field="enabled"
      isOn={(s) => s.border.enabled}
      onChange={(enabled) => setField('border', 'enabled', enabled)}
    >
      <Setting k="border" field="width" label={s.width} htmlFor={widthId}>
        <NumberInput
          id={widthId}
          value={values.border.width}
          onChange={(v) => v !== null && setField('border', 'width', v)}
          min={0.25}
          max={20}
          step={0.25}
          suffix="pt"
        />
      </Setting>
      <Setting k="border" field="color" label={s.color}>
        <ColorInput
          ariaLabel={s.borderColor}
          value={values.border.color}
          onChange={(color) => setField('border', 'color', color)}
        />
      </Setting>
    </OptionSection>
  )
}

/** Common framings offered for the letterbox (width / height). */
const LETTERBOX_TARGETS = [1.85, 2, 2.39]

function LetterboxSection() {
  const { values, setField } = useBinding()
  const { settings: s } = useT()
  const percentId = useId()
  const project = useProjectStore((s) => s.project)
  const board = useActiveBoard()
  const { letterbox } = values
  // Frame ratio of the active board: used to show the resulting framing.
  const frameAspect = computeBoardLayout(project, board).frameAspect
  const contain = values.fit === 'contain'

  return (
    <OptionSection
      title={s.letterbox}
      icon="filmstrip"
      k="letterbox"
      field="enabled"
      isOn={(s) => s.letterbox.enabled}
      onChange={(enabled) => setField('letterbox', 'enabled', enabled)}
    >
      <Setting k="letterbox" field="percent" label={s.height} htmlFor={percentId}>
        <NumberInput
          id={percentId}
          value={letterbox.percent}
          onChange={(v) => v !== null && setField('letterbox', 'percent', v)}
          min={0}
          max={MAX_LETTERBOX_PERCENT}
          step={0.5}
          decimals={1}
          suffix="%"
        />
      </Setting>
      <Setting k="letterbox" field="percent" label={s.targetFraming}>
        <div className="letterbox-targets">
          {LETTERBOX_TARGETS.map((target) => (
            <button
              key={target}
              type="button"
              className="letterbox-targets__button"
              disabled={target <= frameAspect}
              title={
                target <= frameAspect
                  ? s.framesWider
                  : s.barsOf(formatDecimal(letterboxPercentFor(frameAspect, target), 1))
              }
              onClick={() =>
                setField(
                  'letterbox',
                  'percent',
                  Number(letterboxPercentFor(frameAspect, target).toFixed(1)),
                )
              }
            >
              {formatDecimal(target, 2)}:1
            </button>
          ))}
        </div>
      </Setting>
      <p className="settings-hint">
        {contain
          ? s.letterboxHint
          : s.letterboxResult(formatDecimal(visibleAspect(frameAspect, letterbox.percent), 2))}
      </p>
    </OptionSection>
  )
}

const mentionPlacements = (s: SettingsTexts): { value: MentionPlacement; label: string; title: string }[] => [
  { value: 'band', label: s.band, title: s.bandTitle },
  { value: 'letterboxBottom', label: s.inLetterbox, title: s.inLetterboxTitle },
]

const bandColors = (s: SettingsTexts): { value: Mention['bandColor']; label: ReactNode; title: string }[] => [
  {
    value: 'black',
    label: (
      <>
        <span className="swatch swatch--black" aria-hidden="true" />
        {s.black}
      </>
    ),
    title: s.blackTitle,
  },
  {
    value: 'white',
    label: (
      <>
        <span className="swatch swatch--white" aria-hidden="true" />
        {s.white}
      </>
    ),
    title: s.whiteTitle,
  },
]

function MentionSection() {
  const { values, setField } = useBinding()
  const { settings: s } = useT()
  const textId = useId()
  const fontId = useId()
  const sizeId = useId()
  const percentId = useId()
  const offsetId = useId()
  const opacityId = useId()
  const { mention, letterbox } = values
  // Each changed field becomes its own override: the others stay inherited.
  const update = (patch: Partial<Mention>) => {
    for (const [field, value] of Object.entries(patch) as [keyof Mention, Mention[keyof Mention]][]) {
      setField('mention', field, value)
    }
  }
  const project = useProjectStore((s) => s.project)
  const board = useActiveBoard()
  // Frame size of the active board: used to show the resulting size.
  const { layout } = computeBoardLayout(project, board)
  const inLetterbox = mention.placement !== 'band'

  return (
    <OptionSection
      title={s.mention}
      icon="text-quote"
      k="mention"
      field="enabled"
      isOn={(s) => s.mention.enabled}
      onChange={(enabled) => update({ enabled })}
    >
      <Setting k="mention" field="text" label={s.text} htmlFor={textId} stacked>
        <textarea
          id={textId}
          className="text-input text-area"
          rows={3}
          value={mention.text}
          placeholder={s.mentionPlaceholder}
          onChange={(e) => update({ text: e.target.value })}
        />
      </Setting>
      <Setting k="mention" field="fontFamily" label={s.font} htmlFor={fontId}>
        <select
          id={fontId}
          className="select"
          value={mention.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value as SafeFont })}
        >
          {SAFE_FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
      </Setting>
      <Setting k="mention" field="autoSize" label={s.autoSize}>
        <Toggle
          label={s.autoSizeLabel}
          checked={mention.autoSize}
          onChange={(autoSize) => update({ autoSize })}
        />
      </Setting>
      <Setting
        k="mention"
        field="fontSize"
        label={mention.autoSize ? s.referenceSize : s.fontSize}
        htmlFor={sizeId}
      >
        <NumberInput
          id={sizeId}
          value={mention.fontSize}
          onChange={(v) => v !== null && update({ fontSize: v })}
          min={3}
          max={72}
          step={0.5}
          decimals={1}
          suffix="pt"
        />
      </Setting>
      <p className="settings-hint">
        {mention.autoSize
          ? s.autoSizeHint(formatDecimal(mention.fontSize, 1)) +
            // Without frames, there is no size to show for this board.
            (layout.cellWidth > 0
              ? s.autoSizeOnBoard(
                  board.name,
                  formatDecimal(mentionFontSize({ w: layout.cellWidth, h: layout.cellHeight }, mention), 1),
                )
              : '')
          : s.fixedSizeHint}
      </p>
      <Setting k="mention" field="align" label={s.alignment}>
        <Segmented
          ariaLabel={s.mentionAlignment}
          value={mention.align}
          options={alignOptions(s)}
          onChange={(align) => update({ align })}
        />
      </Setting>
      <Setting k="mention" field="placement" label={s.placement} stacked>
        <Segmented
          ariaLabel={s.mentionPlacement}
          value={mention.placement}
          options={mentionPlacements(s)}
          onChange={(placement) => update({ placement })}
        />
      </Setting>
      {inLetterbox ? (
        !letterbox.enabled && (
          <p className="settings-hint settings-hint--warning">
            {s.letterboxOff}{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => setField('letterbox', 'enabled', true)}
            >
              {s.enableLetterbox}
            </button>
          </p>
        )
      ) : (
        <>
          <Setting k="mention" field="bandPercent" label={s.height} htmlFor={percentId}>
            <NumberInput
              id={percentId}
              value={mention.bandPercent}
              onChange={(v) => v !== null && update({ bandPercent: v })}
              min={1}
              max={MAX_MENTION_BAND_PERCENT}
              step={0.5}
              decimals={1}
              suffix="%"
            />
          </Setting>
          <Setting k="mention" field="bandOffsetPercent" label={s.offset} htmlFor={offsetId}>
            <NumberInput
              id={offsetId}
              value={mention.bandOffsetPercent}
              onChange={(v) => v !== null && update({ bandOffsetPercent: v })}
              min={0}
              max={MAX_MENTION_OFFSET_PERCENT}
              step={0.5}
              decimals={1}
              suffix="%"
            />
          </Setting>
          <Setting k="mention" field="bandColor" label={s.background} stacked>
            <Segmented
              ariaLabel={s.bandBackground}
              value={mention.bandColor}
              options={bandColors(s)}
              onChange={(bandColor) => update({ bandColor })}
            />
          </Setting>
          <Setting k="mention" field="bandOpacity" label={s.opacity} htmlFor={opacityId}>
            <NumberInput
              id={opacityId}
              value={mention.bandOpacity}
              onChange={(v) => v !== null && update({ bandOpacity: v })}
              min={0}
              max={100}
              step={5}
              integer
              suffix="%"
            />
          </Setting>
        </>
      )}
    </OptionSection>
  )
}

function ProjectSection() {
  const texts = useT()
  const { settings: s } = texts
  const slide = useProjectStore((s) => s.project.slide)
  const fontFamily = useProjectStore((s) => s.project.fontFamily)
  const setSlideFormat = useProjectStore((s) => s.setSlideFormat)
  const setCustomSlideSize = useProjectStore((s) => s.setCustomSlideSize)
  const setFontFamily = useProjectStore((s) => s.setFontFamily)
  const formatId = useId()
  const fontId = useId()
  return (
    <Section id="presentation" title={s.presentation} icon="slide-size">
      <div className="setting">
        <label className="setting__label" htmlFor={formatId}>
          {s.format}
        </label>
        <div className="setting__control">
          <Select id={formatId} value={slide.id} options={slideFormatOptions(texts)} onChange={setSlideFormat} />
        </div>
        <span />
      </div>
      {slide.id === 'custom' && (
        <div className="setting">
          <span className="setting__label">{s.size}</span>
          <div className="setting__control setting__control--pair">
            <CmInput
              ariaLabel={s.slideWidth}
              value={slide.width}
              min={1}
              max={142}
              onChange={(w) => setCustomSlideSize(w, slide.height)}
            />
            <span aria-hidden="true">×</span>
            <CmInput
              ariaLabel={s.slideHeight}
              value={slide.height}
              min={1}
              max={142}
              onChange={(h) => setCustomSlideSize(slide.width, h)}
            />
          </div>
          <span />
        </div>
      )}
      <div className="setting">
        <label className="setting__label" htmlFor={fontId}>
          {s.font}
        </label>
        <div className="setting__control">
          <select
            id={fontId}
            className="select"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value as SafeFont)}
          >
            {SAFE_FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <span />
      </div>
    </Section>
  )
}

export function SettingsPanel() {
  const { settings: s } = useT()
  const [scope, setScope] = useState<Scope>('board')
  const board = useActiveBoard()
  const defaults = useProjectStore((s) => s.project.defaults)
  const setDefault = useProjectStore((s) => s.setDefault)
  const setOverride = useProjectStore((s) => s.setOverride)
  const resetOverride = useProjectStore((s) => s.resetOverride)
  const setOverrideField = useProjectStore((s) => s.setOverrideField)
  const setDefaultField = useProjectStore((s) => s.setDefaultField)
  const resetAllOverrides = useProjectStore((s) => s.resetAllOverrides)

  const overrideCount = countOverrides(board.overrides)

  const binding: Binding = {
    scope,
    values: scope === 'board' ? resolveSettings(defaults, board.overrides) : defaults,
    set: (key, value) => (scope === 'board' ? setOverride(board.id, key, value) : setDefault(key, value)),
    setField: (key, field, value) =>
      scope === 'board' ? setOverrideField(board.id, key, field, value) : setDefaultField(key, field, value),
    isOverridden: (key, field) => scope === 'board' && isOverridden(board.overrides, key, field),
    reset: (key, field) => resetOverride(board.id, key, field),
  }

  return (
    <aside className="settings-panel" aria-label={s.title}>
      <h2 className="settings-panel__title">{s.title}</h2>
      <div className="settings-panel__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={scope === 'board'} onClick={() => setScope('board')}>
          <Icon name="slide-layout" size={16} />
          <span className="settings-panel__tab-label">{board.name}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'project'}
          onClick={() => setScope('project')}
        >
          <Icon name="settings" size={16} />
          <span className="settings-panel__tab-label">{s.projectTab}</span>
        </button>
      </div>

      <div className="settings-panel__body">
        {scope === 'board' ? (
          overrideCount > 0 && (
            <div className="settings-banner">
              <span>{s.overrides(overrideCount)}</span>
              <button type="button" className="link-button" onClick={() => resetAllOverrides(board.id)}>
                {s.resetAll}
              </button>
            </div>
          )
        ) : (
          <>
            <p className="settings-hint settings-hint--intro">{s.projectIntro}</p>
            <ProjectSection />
          </>
        )}

        <BindingContext.Provider value={binding}>
          <GridSection />
          <SpacingSection />
          <TitleSection />
          <TextSection />
          <NumberingSection />
          <BorderSection />
          <LetterboxSection />
          <MentionSection />
        </BindingContext.Provider>
      </div>
    </aside>
  )
}
