import React, { useMemo } from "react";

import { useAtomValue, useSetAtom } from "../../editor-jotai";
import {
  calibrationStateAtom,
  calibrationQualityGateAtom,
  confidenceStateAtom,
  markCalibrationTaskDoneAtom,
  markCalibrationTaskUndoneAtom,
} from "../AIArchitectureGeneration";

export const CalibrateStep: React.FC = () => {
  const calibrationState = useAtomValue(calibrationStateAtom);
  const qualityGate = useAtomValue(calibrationQualityGateAtom);
  const confidenceState = useAtomValue(confidenceStateAtom);
  const markDone = useSetAtom(markCalibrationTaskDoneAtom);
  const markUndone = useSetAtom(markCalibrationTaskUndoneAtom);

  const summary = useMemo(() => {
    const total = calibrationState.tasks.length;
    const done = calibrationState.tasks.filter((task) => task.done).length;
    return { total, done };
  }, [calibrationState.tasks]);

  return (
    <div className="ai-architecture-generation-dialog__step">
      <h3>AI 校准</h3>
      <p>按校准任务逐项完成，质量门槛通过后才会标记为可信现状。</p>
      <div className="ai-architecture-generation-dialog__summary">
        校准任务: {summary.done}/{summary.total} | 把握度状态: {confidenceState}
      </div>
      <div className="ai-architecture-generation-dialog__summary">
        质量门槛: {qualityGate.ready ? "通过" : "未通过"}
      </div>
      {!qualityGate.ready && (
        <div className="ai-architecture-generation-dialog__issue-card">
          <strong>可信现状阻断原因</strong>
          {qualityGate.reasons.map((reason) => (
            <div key={reason}>{reason}</div>
          ))}
        </div>
      )}
      {summary.total === 0 && (
        <div className="ai-architecture-generation-dialog__success">
          当前没有待校准任务，状态已稳定。
        </div>
      )}
      {confidenceState === "confirmed" && qualityGate.ready && (
        <div className="ai-architecture-generation-dialog__success">
          已标记为可信现状（confirmed）
        </div>
      )}
      <div className="ai-architecture-generation-dialog__issue-groups">
        {calibrationState.tasks.map((task) => (
          <article key={task.id} className="ai-architecture-generation-dialog__issue-card">
            <div>{task.title}</div>
            <div>阻断级: {task.blocking ? "是" : "否"}</div>
            <div>状态: {task.done ? "已完成" : "待处理"}</div>
            <div className="ai-architecture-generation-dialog__actions">
              {!task.done ? (
                <button type="button" onClick={() => markDone(task.id)}>
                  标记完成
                </button>
              ) : (
                <button type="button" onClick={() => markUndone(task.id)}>
                  取消完成
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

