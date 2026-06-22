import { Fragment, type FocusEvent, type JSX, type ReactNode } from "react";
import {
  BulletListMarker,
  CodeBlockStyle,
  CodeFence,
  DownloadMode,
  EmDelimiter,
  HeadingStyle,
  HorizontalRuleStyle,
  ImageReferenceStyle,
  ImageStyle,
  LinkReferenceStyle,
  LinkStyle,
  StrongDelimiter
} from "../shared/options/defaults";
import type { MarkdownSaveOptionField, MarkdownSaveOptions } from "../shared/options/schema";
import { isImageStyleChoiceDisabled, isOptionFieldVisible } from "./options-fields";

/** options 表单组件属性。 */
export interface OptionsFormProps {
  /** 当前 options。 */
  options: MarkdownSaveOptions;
  /** 是否禁用。 */
  disabled: boolean;
  /** 保存字段。 */
  onSaveField<Field extends MarkdownSaveOptionField>(field: Field, value: MarkdownSaveOptions[Field]): Promise<void>;
}

/** 选项卡片单选项。 */
interface RadioChoiceDefinition {
  /** 值。 */
  value: string;
  /** 标题。 */
  title: string;
  /** 示例。 */
  example?: string;
}

/** 单行文本字段。 */
type TextSettingField =
  | "title"
  | "mdClipsFolder"
  | "disallowedChars"
  | "obsidianVault"
  | "obsidianFolder"
  | "imagePrefix";

/** 多行文本字段。 */
type TextareaSettingField = "frontmatter" | "backmatter";

/** 渲染完整 MarkDownload options 表单。 */
export function OptionsForm({ options, disabled, onSaveField }: OptionsFormProps): JSX.Element {
  return (
    <form aria-label="MarkdownSave options" className="options-form">
      <details className="options-details">
        <summary>
          <h2>Custom text</h2>
          <span aria-hidden="true">ℹ️</span>
        </summary>
        <div className="instructions">
          <p>For title, front-matter, and back-matter templates, you can use these replacement variables:</p>
          <ul>
            <li>
              <code>{"{title}"}</code> - Article Title
            </li>
            <li>
              <code>{"{pageTitle}"}</code> - Original Page Title
            </li>
            <li>
              <code>{"{excerpt}"}</code> - Article excerpt
            </li>
            <li>
              <code>{"{byline}"}</code> - Author metadata
            </li>
            <li>
              <code>{"{date:FORMAT}"}</code> - Current date and time
            </li>
            <li>
              <code>{"{baseURI}"}</code>, <code>{"{origin}"}</code>, <code>{"{host}"}</code>, <code>{"{hostname}"}</code>,{" "}
              <code>{"{pathname}"}</code>, <code>{"{search}"}</code>, <code>{"{hash}"}</code>
            </li>
          </ul>
          <p>
            You can also parameterize most text variables with <code>:lower</code>, <code>:upper</code>,{" "}
            <code>:pascal</code>, <code>:camel</code>, <code>:kebab</code>, <code>:mixed-kebab</code>,{" "}
            <code>:snake</code>, <code>:mixed_snake</code>, and <code>:obsidian-cal</code>.
          </p>
          <p>
            Date format reference:{" "}
            <a href="https://momentjs.com/docs/#/displaying/format/" rel="noreferrer" target="_blank">
              moment.js display format
            </a>
          </p>
        </div>
      </details>

      <h3>Title template</h3>
      <TextSetting
        disabled={disabled}
        field="title"
        label="Template for title / filename"
        onSaveField={onSaveField}
        options={options}
      />

      <div className="options-spacer" />

      <TextSetting
        disabled={disabled}
        field="mdClipsFolder"
        label={
          <>
            Folder inside <code>Downloads/</code> to store MarkdownSave clips
          </>
        }
        onSaveField={onSaveField}
        options={options}
      />

      <div className="options-spacer" />

      <TextSetting
        disabled={disabled}
        field="disallowedChars"
        label={
          <>
            Disallowed characters to strip from filenames in addition to <code>/ ? &lt; &gt; \ : * | "</code>
          </>
        }
        onSaveField={onSaveField}
        options={options}
      />

      <h3>Front-matter template</h3>
      <TextareaSetting
        disabled={disabled}
        field="frontmatter"
        label="Text that should appear at the top of the output file."
        onSaveField={onSaveField}
        options={options}
      />

      <h3>Back-matter template</h3>
      <TextareaSetting
        disabled={disabled}
        field="backmatter"
        label="Text that should appear at the bottom of the output file."
        onSaveField={onSaveField}
        options={options}
      />

      <CheckboxSetting
        disabled={disabled}
        field="includeTemplate"
        label="Append front/back template to clipped text"
        onSaveField={onSaveField}
        options={options}
      />

      <hr />

      <section id="otherOptions">
        <h2>Other options</h2>

        <CheckboxSetting
          disabled={disabled}
          field="contextMenus"
          label="Enable Context Menus"
          onSaveField={onSaveField}
          options={options}
        />

        <div className="options-spacer" />

        <CheckboxSetting
          description={
            <>
              For Obsidian integration, install and enable the community plugin <code>Advanced Obsidian URI</code>.{" "}
              <a href="https://vinzent03.github.io/obsidian-advanced-uri/" rel="noreferrer" target="_blank">
                Learn more
              </a>
              .
            </>
          }
          disabled={disabled}
          field="obsidianIntegration"
          heading="Obsidian Integration"
          label="Enable Obsidian Integration"
          onSaveField={onSaveField}
          options={options}
        />

        <div className="options-spacer" />

        <TextSetting
          disabled={disabled}
          field="obsidianVault"
          label="Obsidian Vault Name"
          onSaveField={onSaveField}
          options={options}
          placeholder="If blank, the main vault will be used."
        />
        <TextSetting
          disabled={disabled}
          field="obsidianFolder"
          label="Obsidian Folder Name"
          onSaveField={onSaveField}
          options={options}
          placeholder="Enter folder name, e.g. Clippers"
        />

        <div className="options-spacer" />

        <RadioGroupSetting
          choices={[
            { value: DownloadMode.DOWNLOADS_API, title: "Downloads API (recommended)" },
            { value: DownloadMode.CONTENT_LINK, title: "Content Link" }
          ]}
          description={
            <>
              Method to use for downloading Markdown files. Set to <strong>Content Link</strong> if the Downloads API
              conflicts with another extension or generates unstable filenames.
            </>
          }
          disabled={disabled}
          field="downloadMode"
          note={
            <strong>
              Note: Content Link mode disables some functionality such as downloading images or using subfolders in the
              filename.
            </strong>
          }
          onSaveField={onSaveField}
          options={options}
          title="Download Mode"
        />

        <div id="downloadModeGroup">
          {isOptionFieldVisible(options, "saveAs") ? (
            <CheckboxSetting
              disabled={disabled}
              field="saveAs"
              label="Always show Save As dialog"
              onSaveField={onSaveField}
              options={options}
            />
          ) : null}

          <div className="options-spacer" />

          {isOptionFieldVisible(options, "downloadImages") ? (
            <CheckboxSetting
              disabled={disabled}
              field="downloadImages"
              label="Download images alongside markdown files"
              onSaveField={onSaveField}
              options={options}
            />
          ) : null}

          {isOptionFieldVisible(options, "imagePrefix") ? (
            <TextSetting
              disabled={disabled}
              field="imagePrefix"
              label="Image filename prefix template"
              onSaveField={onSaveField}
              options={options}
            />
          ) : null}
        </div>
      </section>

      <hr />

      <h2>Markdown conversion options</h2>

      <RadioGroupSetting
        choices={[
          { value: HeadingStyle.SETEXT, title: "Setext-Style Headers", example: "All About Dogs\n==============" },
          { value: HeadingStyle.ATX, title: "Atx-Style Headers", example: "# All About Dogs" }
        ]}
        disabled={disabled}
        field="headingStyle"
        onSaveField={onSaveField}
        options={options}
        title="Heading Style"
      />

      <RadioGroupSetting
        choices={[
          { value: HorizontalRuleStyle.ASTERISKS, title: "***" },
          { value: HorizontalRuleStyle.DASHES, title: "---" },
          { value: HorizontalRuleStyle.UNDERSCORES, title: "___" }
        ]}
        disabled={disabled}
        field="hr"
        onSaveField={onSaveField}
        options={options}
        title="Horizontal Rule style"
      />

      <RadioGroupSetting
        choices={[
          { value: BulletListMarker.ASTERISK, title: "*" },
          { value: BulletListMarker.DASH, title: "-" },
          { value: BulletListMarker.PLUS, title: "+" }
        ]}
        disabled={disabled}
        field="bulletListMarker"
        onSaveField={onSaveField}
        options={options}
        title="Bullet List Marker"
      />

      <RadioGroupSetting
        choices={[
          {
            value: CodeBlockStyle.INDENTED,
            title: "Indented",
            example: '····const helloWorld = () => {\n········console.log("Hello World");\n····}'
          },
          {
            value: CodeBlockStyle.FENCED,
            title: "Fenced",
            example: '```\nconst helloWorld = () => {\n····console.log("Hello World");\n}\n```'
          }
        ]}
        disabled={disabled}
        field="codeBlockStyle"
        onSaveField={onSaveField}
        options={options}
        title="Code Block Style"
      />

      {isOptionFieldVisible(options, "fence") ? (
        <RadioGroupSetting
          choices={[
            { value: CodeFence.BACKTICKS, title: "```" },
            { value: CodeFence.TILDES, title: "~~~" }
          ]}
          disabled={disabled}
          field="fence"
          onSaveField={onSaveField}
          options={options}
          title="Code Block Fence"
        />
      ) : null}

      <RadioGroupSetting
        choices={[
          { value: EmDelimiter.UNDERSCORE, title: "_italics_" },
          { value: EmDelimiter.ASTERISK, title: "*italics*" },
          { value: EmDelimiter.DOUBLE_UNDERSCORE, title: "__italics__", example: "(Non-standard. Roam specific.)" }
        ]}
        disabled={disabled}
        field="emDelimiter"
        onSaveField={onSaveField}
        options={options}
        title="Emphasis (italics) Delimiter"
      />

      <RadioGroupSetting
        choices={[
          { value: StrongDelimiter.DOUBLE_ASTERISK, title: "**bold**" },
          { value: StrongDelimiter.DOUBLE_UNDERSCORE, title: "__bold__" }
        ]}
        disabled={disabled}
        field="strongDelimiter"
        onSaveField={onSaveField}
        options={options}
        title="Strong (bold) Delimiter"
      />

      <RadioGroupSetting
        choices={[
          { value: LinkStyle.INLINED, title: "Inlined", example: "[Google](http://google.com)" },
          {
            value: LinkStyle.REFERENCED,
            title: "Referenced",
            example: "[Google]\n\n[Google]: http://google.com"
          },
          { value: LinkStyle.STRIP_LINKS, title: "Strip Links", example: "Google" }
        ]}
        disabled={disabled}
        field="linkStyle"
        onSaveField={onSaveField}
        options={options}
        title="Link Style"
      />

      {isOptionFieldVisible(options, "linkReferenceStyle") ? (
        <RadioGroupSetting
          choices={[
            { value: LinkReferenceStyle.FULL, title: "Full", example: "[Google][1]\n\n[1]: http://google.com" },
            {
              value: LinkReferenceStyle.COLLAPSED,
              title: "Collapsed",
              example: "[Google][]\n\n[Google]: http://google.com"
            },
            {
              value: LinkReferenceStyle.SHORTCUT,
              title: "Shortcut",
              example: "[Google]\n\n[Google]: http://google.com"
            }
          ]}
          disabled={disabled}
          field="linkReferenceStyle"
          onSaveField={onSaveField}
          options={options}
          title="Link Reference Style"
        />
      ) : null}

      <RadioGroupSetting
        choices={[
          { value: ImageStyle.ORIGINAL_SOURCE, title: "Original Source", example: "![](http://example.com/img/image.jpg)" },
          { value: ImageStyle.NO_IMAGE, title: "Strip Images", example: " " },
          { value: ImageStyle.MARKDOWN, title: "Pure Markdown", example: "![](folder/image.jpg)" },
          {
            value: ImageStyle.BASE64,
            title: "Base64 encoded",
            example: "![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==)"
          },
          { value: ImageStyle.OBSIDIAN, title: "Obsidian internal embed", example: "![[folder/image.jpg]]" },
          {
            value: ImageStyle.OBSIDIAN_NOFOLDER,
            title: "Obsidian internal embed (no folder prefix)",
            example: "![[image.jpg]]"
          }
        ]}
        disabled={disabled}
        field="imageStyle"
        note={<strong>Note: The following markdown-style image outputs only apply when Download Images is enabled.</strong>}
        onSaveField={onSaveField}
        options={options}
        title="Image Style"
      />

      {isOptionFieldVisible(options, "imageRefStyle") ? (
        <RadioGroupSetting
          choices={[
            { value: ImageReferenceStyle.INLINED, title: "Inlined", example: "![](address/of/image.jpg)" },
            {
              value: ImageReferenceStyle.REFERENCED,
              title: "Referenced",
              example: "![][fig1]\n\n[fig1]: address/of/image.jpg"
            }
          ]}
          disabled={disabled}
          field="imageRefStyle"
          note={<strong>Note: Image Reference Style only applies to markdown image output, not Obsidian embeds.</strong>}
          onSaveField={onSaveField}
          options={options}
          title="Image Reference Style"
        />
      ) : null}

      <CheckboxSetting
        description={
          <small>
            By default, Markdown special characters in the HTML input are escaped with backslashes. Disabling this
            option turns that escaping off.
          </small>
        }
        disabled={disabled}
        field="turndownEscape"
        label="Escape Markdown Characters"
        onSaveField={onSaveField}
        options={options}
      />
    </form>
  );
}

/** 文本设置。 */
interface TextSettingProps<Field extends TextSettingField> {
  /** 当前配置。 */
  options: MarkdownSaveOptions;
  /** 字段名。 */
  field: Field;
  /** 标签。 */
  label: ReactNode;
  /** 是否禁用。 */
  disabled: boolean;
  /** 占位符。 */
  placeholder?: string;
  /** 保存回调。 */
  onSaveField(saveField: Field, value: MarkdownSaveOptions[Field]): Promise<void>;
}

/** 渲染单行文本设置。 */
function TextSetting<Field extends TextSettingField>({
  options,
  field,
  label,
  disabled,
  placeholder,
  onSaveField
}: TextSettingProps<Field>): JSX.Element {
  const rawValue = options[field];
  const value = typeof rawValue === "string" ? rawValue : rawValue ?? "";

  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    const nextValue = event.currentTarget.value;

    if (nextValue === value) {
      return;
    }

    void onSaveField(field, nextValue as MarkdownSaveOptions[Field]);
  };

  return (
    <div className="textbox-container">
      <label htmlFor={field}>{label}</label>
      <input
        aria-label={typeof label === "string" ? label : String(field)}
        defaultValue={value}
        disabled={disabled}
        id={field}
        name={field}
        placeholder={placeholder}
        type="text"
        onBlur={handleBlur}
      />
    </div>
  );
}

/** 多行文本设置。 */
interface TextareaSettingProps<Field extends TextareaSettingField> {
  /** 当前配置。 */
  options: MarkdownSaveOptions;
  /** 字段名。 */
  field: Field;
  /** 标签。 */
  label: string;
  /** 是否禁用。 */
  disabled: boolean;
  /** 保存回调。 */
  onSaveField(saveField: Field, value: MarkdownSaveOptions[Field]): Promise<void>;
}

/** 渲染多行文本设置。 */
function TextareaSetting<Field extends TextareaSettingField>({
  options,
  field,
  label,
  disabled,
  onSaveField
}: TextareaSettingProps<Field>): JSX.Element {
  const rawValue = options[field];
  const value = typeof rawValue === "string" ? rawValue : "";

  const handleBlur = (event: FocusEvent<HTMLTextAreaElement>): void => {
    const nextValue = event.currentTarget.value;

    if (nextValue === value) {
      return;
    }

    void onSaveField(field, nextValue as MarkdownSaveOptions[Field]);
  };

  return (
    <div className="textbox-container">
      <label htmlFor={field}>{label}</label>
      <div className="input-sizer">
        <textarea
          aria-label={label}
          defaultValue={value}
          disabled={disabled}
          id={field}
          name={field}
          rows={8}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
}

/** checkbox 设置。 */
interface CheckboxSettingProps<Field extends MarkdownSaveOptionField> {
  /** 当前配置。 */
  options: MarkdownSaveOptions;
  /** 字段名。 */
  field: Field;
  /** 标签。 */
  label: ReactNode;
  /** 是否禁用。 */
  disabled: boolean;
  /** 标题。 */
  heading?: string;
  /** 描述。 */
  description?: ReactNode;
  /** 保存回调。 */
  onSaveField(saveField: Field, value: MarkdownSaveOptions[Field]): Promise<void>;
}

/** 渲染 checkbox 设置。 */
function CheckboxSetting<Field extends MarkdownSaveOptionField>({
  options,
  field,
  label,
  disabled,
  heading,
  description,
  onSaveField
}: CheckboxSettingProps<Field>): JSX.Element {
  const checked = options[field] === true;

  return (
    <div className="checkbox-container">
      {heading !== undefined ? <h3>{heading}</h3> : null}
      {description !== undefined ? <p>{description}</p> : null}
      <input
        checked={checked}
        disabled={disabled}
        id={field}
        name={field}
        type="checkbox"
        onChange={(event) => {
          void onSaveField(field, event.currentTarget.checked as MarkdownSaveOptions[Field]);
        }}
      />
      <label htmlFor={field}>{label}</label>
    </div>
  );
}

/** radio group 设置。 */
interface RadioGroupSettingProps<Field extends MarkdownSaveOptionField> {
  /** 当前配置。 */
  options: MarkdownSaveOptions;
  /** 字段名。 */
  field: Field;
  /** 标题。 */
  title: string;
  /** 描述。 */
  description?: ReactNode;
  /** 备注。 */
  note?: ReactNode;
  /** 候选项。 */
  choices: ReadonlyArray<RadioChoiceDefinition>;
  /** 是否禁用。 */
  disabled: boolean;
  /** 保存回调。 */
  onSaveField(saveField: Field, value: MarkdownSaveOptions[Field]): Promise<void>;
}

/** 渲染 radio group。 */
function RadioGroupSetting<Field extends MarkdownSaveOptionField>({
  options,
  field,
  title,
  description,
  note,
  choices,
  disabled,
  onSaveField
}: RadioGroupSettingProps<Field>): JSX.Element {
  const currentValue = String(options[field]);

  return (
    <div className="radio-container">
      <h3>{title}</h3>
      {description !== undefined ? <p>{description}</p> : null}
      {note !== undefined ? <p>{note}</p> : null}
      {choices.map((choice) => {
        const id = `${field}-${encodeURIComponent(choice.value)}`;
        const choiceDisabled =
          disabled || (field === "imageStyle" && isImageStyleChoiceDisabled(options, choice.value));

        return (
          <Fragment key={id}>
            <input
              checked={currentValue === choice.value}
              disabled={choiceDisabled}
              id={id}
              name={field}
              type="radio"
              value={choice.value}
              onChange={(event) => {
                void onSaveField(field, event.currentTarget.value as MarkdownSaveOptions[Field]);
              }}
            />
            <label htmlFor={id}>
              <span>{choice.title}</span>
              {choice.example !== undefined ? <pre>{choice.example}</pre> : null}
            </label>
          </Fragment>
        );
      })}
    </div>
  );
}
