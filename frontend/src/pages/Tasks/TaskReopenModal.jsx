import React, { useEffect } from "react";
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Typography,
  DatePicker,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useReopenTaskMutation } from "../../api/taskApi";
import { notifySuccess, notifyError } from '../../utils/notify';
import { isCompletedTask } from "./taskDuration";

const { TextArea } = Input;
const { Text } = Typography;

const REOPEN_CATEGORIES = [
  { value: "Reopen", label: "Reopen (Overdue / Incomplete)" },
  { value: "Correction", label: "Correction" },
  { value: "Redesign", label: "Redesign" },
  { value: "Internal Correction", label: "Internal Correction" },
  { value: "Client Correction", label: "Client Correction" },
];

/**
 * TaskReopenModal — Used to reopen any task (overdue, in-progress, or completed)
 * by preserving the original due-date task and creating a new task assigned today.
 */
const TaskReopenModal = ({ task, visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [reopenTask, { isLoading }] = useReopenTaskMutation();

  useEffect(() => {
    if (visible && task) {
      const isCompleted = isCompletedTask(task.status);
      const defaultCategory = isCompleted ? "Correction" : "Reopen";
      const defaultDetails = task.description 
        ? task.description 
        : `Reopening task "${task.title}" for separate completion`;
      
      const defaultDueDate = task.dueDate 
        ? (dayjs(task.dueDate).isBefore(dayjs()) ? dayjs().add(1, 'day') : dayjs(task.dueDate).add(1, 'day'))
        : dayjs().add(1, 'day');

      form.setFieldsValue({
        reopenCategory: defaultCategory,
        dueDate: defaultDueDate,
        startDate: dayjs(),
        correctionDetails: defaultDetails,
      });
    }
  }, [visible, task, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const targetDueDate = values.dueDate ? values.dueDate.endOf('day') : dayjs().add(1, 'day').endOf('day');
      const targetStartDate = dayjs().startOf('day');
      await reopenTask({
        id: task._id,
        reopenCategory: values.reopenCategory,
        correctionDetails: values.correctionDetails,
        startDate: targetStartDate.toISOString(),
        dueDate: targetDueDate.toISOString(),
      }).unwrap();
      notifySuccess('reopen', task._id, `Task reopened successfully`);
      form.resetFields();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      if (err?.data?.message) {
        notifyError('reopen', task._id, err.data.message);
      }
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      open={visible}
      onCancel={handleCancel}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ReloadOutlined style={{ color: "#f59e0b" }} />
          <span>Reopen Task / Create Continuation Task</span>
        </div>
      }
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<ReloadOutlined />}
          loading={isLoading}
          onClick={handleSubmit}
          style={{ background: "#f59e0b", borderColor: "#f59e0b" }}
        >
          Reopen Task
        </Button>,
      ]}
      destroyOnClose
      width={540}
    >
      {task && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "#fffbeb",
            borderRadius: 8,
            border: "1px solid #fef3c7",
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Original Task: </Text>
            <Text strong style={{ fontSize: 13 }}>{task.title}</Text>
          </div>
          <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.4 }}>
            ℹ️ The original task (Due: {task.dueDate ? dayjs(task.dueDate).format("DD/MM/YYYY") : "N/A"}) will remain saved as it is. A new task will be created with the assignment date so it can be completed separately without affecting project deliverable counts.
          </div>
        </div>
      )}

      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="reopenCategory"
          label="Reopen Reason / Category"
          rules={[{ required: true, message: "Please select a category" }]}
        >
          <Select
            placeholder="Select category"
            options={REOPEN_CATEGORIES}
          />
        </Form.Item>

        <Form.Item
          name="dueDate"
          label="New Due Date"
          rules={[{ required: true, message: "Please select a due date" }]}
        >
          <DatePicker
            style={{ width: "100%" }}
            format="DD/MM/YYYY"
            disabledDate={(current) => current && current < dayjs().startOf("day")}
          />
        </Form.Item>

        <Form.Item
          name="correctionDetails"
          label="Details / Notes"
          rules={[
            {
              required: true,
              message: "Please describe the task work or reason for reopening",
            },
            { min: 3, message: "Please provide at least 3 characters" },
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Describe what needs to be worked on..."
            showCount
            maxLength={1000}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TaskReopenModal;
