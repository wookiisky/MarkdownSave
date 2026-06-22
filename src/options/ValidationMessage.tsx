import type { JSX } from "react";
import type { OptionsStorageError } from "./options-storage";
import type { OptionsStoreNotice } from "./useOptionsStore";

/** 校验消息组件属性。 */
export interface ValidationMessageProps {
  /** 状态文案。 */
  notice: OptionsStoreNotice;
  /** 错误列表。 */
  errors: ReadonlyArray<OptionsStorageError>;
  /** 被隔离的未知字段。 */
  ignoredFields: ReadonlyArray<string>;
}

/** 显示 options 校验、迁移和导入导出结果。 */
export function ValidationMessage({ notice, errors, ignoredFields }: ValidationMessageProps): JSX.Element {
  const className = `validation-message validation-message-${notice.kind}`;

  return (
    <section aria-label="Options status" className={className}>
      <p>{notice.text}</p>
      {errors.length > 0 ? (
        <ul>
          {errors.map((error) => (
            <li key={`${error.code}:${error.message}`}>
              {error.message}
              {error.validationErrors !== undefined && error.validationErrors.length > 0 ? (
                <span>：{error.validationErrors.map((validationError) => validationError.message).join("；")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {ignoredFields.length > 0 ? <p>已隔离未知字段：{ignoredFields.join(", ")}</p> : null}
    </section>
  );
}
