/**
 * 标注任务大厅和 sp-task 两个页面都在用当前组件
 */
import React, { useState, useEffect } from 'react';
import { message, Select, Typography } from 'antd';
import type {
  MarkTaskBagResponse,
  TaskType,
  QuestionnaireType,
  Triggers,
} from '../../components/GeneralConfig/type';
import { history, useModel } from 'umi';
import { getTaskTypes, getTagBag, getBatches, postTagBag } from '../../services/MarkTaskHall';
import AttributeLabel from '../../components/AttributeLabel';
import FormComponent from '../../components/GeneralConfig';
import MvizContent from "@/components/MvizContent";
import { getQuestion, organizeFromData } from '../../components/GeneralConfig/utils';
import styles from './index.css';
const { Option } = Select;
const { Paragraph } = Typography;
const MarkTaskHall = () => {
  const { query, pathname } = history.location;
  const isSpTask = /^\/sp-task\/?/.test(pathname);
  const isDevMode = query.next === '1';
  const { initialState } = useModel('@@initialState');
  const { currentUser } = initialState;
  const [bagData, setBagData] = useState<MarkTaskBagResponse>(); // bag数据
  const [success, setSuccess] = useState<boolean>(); // 请求是否成功
  const [readOnly, setReadOnly] = useState<boolean>(false);
  const [submited, setSubmited] = useState<boolean>(false);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]); // 任务类型列表
  const [selectedType, setSelectedType] = useState<string>(query.tag_type as string); // 选择的任务类型
  const [isShowBatchSelect, setIsShowBatchSelect] = useState(false);
  const [batchOptions, setBatchOptions] = useState([]);
  const [batchName, setBatchName] = useState<string>((query.batch as string) || '');
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireType>(null); // 问题
  const [triggers, setTriggers] = useState<QuestionnaireType & Omit<Triggers, 'question_id'>[]>(
    null,
  );

  const [allState, setAllState] = useState<Record<string, any>>(null);
  const [origin] = useState(query.origin || null);
  const [allFormValues, setAllFormValues] = useState(new Map());
  const getTaskTypeList = async () => {
    const res = await getTaskTypes();
    if (res.status === 0) {
      const result = res.data.task_types;
      setTaskTypes(result);
      return result;
    }
    return [];
  };
  const getBatchesList = async (task_type_name) => {
    const res = await getBatches({ task_type_name });
    if (res.status === 0) {
      setBatchOptions(res.data.batches);
    }
  };

  const showBatchSelect = (selected_type, task_types = taskTypes) => {
    return task_types.some((tasktype) => {
      if (tasktype.task_type === selected_type) {
        return tasktype.is_batch_selectable;
      }
      return false;
    });
  };

  const fetchBag = async (tagger_id, tag?: string, batch?: string) => {
    if (!tagger_id) return;
    const params = {
      tagger_id,
      //后续可以去掉 selectedType，直接使用 tag（都根据url）
      tag_type: tag || selectedType,
      batch: batch || '',
      share_code: query.share_code ? query.share_code : '',
    };
    if (query.bag_id) {
      Object.assign(params, { bag_id: query.bag_id });
    }
    const data = await getTagBag(params);
    if (data?.status === 0) {
      setReadOnly(!data?.questionnaire?.editable);
      setBagData(data as unknown as MarkTaskBagResponse);
      setQuestionnaire((data as unknown as MarkTaskBagResponse)?.questionnaire);

      // eslint-disable-next-line @typescript-eslint/no-shadow
      const questionnaire = (data as unknown as MarkTaskBagResponse)?.questionnaire;

      console.log(questionnaire);
      const trigger_list = [] as QuestionnaireType & Omit<Triggers, 'question_id'>[];
      questionnaire?.triggers?.forEach((item) => {
        const question = getQuestion(questionnaire?.questions, item.question_id);
        if (question) trigger_list.push({ ...item, ...question });
      });
      setTriggers(trigger_list);

      if (allState) {
        if (allState?.setFormValues) allState?.setFormValues({});
        if (allState?.setOptionMap) allState?.setOptionMap({});
        if (allState?.form) allState?.form.resetFields();
      }
    } else {
      const bag = {
        bag_id: '',
        bag_md5: '',
        batch: '',
        mviz_url: '',
        scene: '',
      };
      data.bag = bag;
      setBagData(data as unknown as MarkTaskBagResponse);
    }
    setSuccess(data?.status === 0);
  };

  const submit = async (values: any, setFormValues: any, setOptionMap: any) => {
    if (submited) {
      message.warn('当前问卷已提交！');
      return true;
    }
    const { questions, tags } = organizeFromData(values, questionnaire?.triggers);
    const res = await postTagBag({
      tag_type: bagData.tag_type,
      tagger_id: currentUser?.tagger_id,
      bag_id: bagData.bag.bag_id,
      bag_md5: bagData.bag.bag_md5,
      task_type_id: Number(selectedType),
      questionnaire_id: bagData.questionnaire.questionnaire_id,
      questionnaire_version: bagData.questionnaire.questionnaire_version,
      answers: {
        questions,
        tags,
      },
    });
    if (res.status === 0) {
      message.success('提交成功');
      // 特定的 task 提交之后，停留在当前状态，并且无法再次提价
      if (isSpTask || isDevMode) {
        setSubmited(true);
        return true;
      }
      setSuccess(false);
      setQuestionnaire(null);
      setTriggers(null);
      setFormValues({});
      setOptionMap({});
      setAllFormValues(new Map());
      location.reload();
      // fetchBag(currentUser?.tagger_id, selectedType, batchName);
    }
    return true;
  };

  const handleFilter = (input, option) => {
    return (option!.children as unknown as string).toLowerCase().includes(input.toLowerCase());
  };

  useEffect(() => {
    getTaskTypeList().then((task_types) => {
      if (selectedType) {
        const showBatch = showBatchSelect(selectedType, task_types);
        setIsShowBatchSelect(showBatch);
        if (showBatch) {
          getBatchesList(selectedType);
        }
        fetchBag(currentUser?.tagger_id, selectedType, batchName);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTaskTypeChange = (val) => {
    setSelectedType(val);
    history.push(`${pathname}?tag_type=${val}`, { replace: true });
    const showBatch = showBatchSelect(val);
    setIsShowBatchSelect(showBatch);
    setBatchName('');
    setBatchOptions([]);

    if (showBatch) {
      getBatchesList(val);
    }
    fetchBag(currentUser?.tagger_id, val);
  };

  const handleBatchChange = (val = '') => {
    // 兼容 onclear
    if (batchName === val) return;
    setBatchName(val);
    history.push(`${pathname}?tag_type=${selectedType}&batch=${val}`, { replace: true });
    fetchBag(currentUser?.tagger_id, selectedType, val);
  };

  return (
    <AttributeLabel
      bagData={bagData?.bag}
      success={success}
      total={bagData?.today_count}
      fetchBag={fetchBag}
      isView={isSpTask}
      title={
        !isSpTask ? (
          <>
            <div style={{
              fontWeight: 400,
              display:'flex',
              justifyContent:'center',
              alignItems: 'center',
            }}>
                <span className={styles.label}>标注:</span>
                <Select
                  style={{ width: '200px' }}
                  disabled={origin === 'external'}
                  value={selectedType}
                  onChange={handleTaskTypeChange}
                  showSearch
                  filterOption={handleFilter}
                  placeholder="请选择标注任务"
                >
                  {taskTypes.map((taskType) => (
                    // <Option value={taskType.task_type_id} key={taskType.task_type_id}>
                    <Option value={taskType.task_type} key={taskType.task_type_id}>
                      {taskType.task_type_name}
                    </Option>
                  ))}
                </Select>
              </div>
              {isShowBatchSelect && (
                <div style={{ marginTop: 10}}>
                  <span style={{ display: 'inline-block', width: '3em', marginRight: 10 }}>
                    Batch
                  </span>
                  <Select
                    showSearch
                    allowClear
                    style={{ width: 208 }}
                    disabled={origin === 'external'}
                    value={batchName}
                    onChange={handleBatchChange}
                    placeholder="请选择标注 Batch"
                  >
                    {batchOptions.map((option) => (
                      <Option value={option} key={option}>
                        {option}
                      </Option>
                    ))}
                  </Select>
                </div>
              )}

          </>
        ) : null
      }
    >
      {success && (
        <>
          {questionnaire?.questionnaire_desc && (
            <Paragraph
              ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}
              style={{
                background: 'rgba(245,245,245, 1)',
                margin: '16px 0',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 'bold',
              }}
            >
              {questionnaire?.questionnaire_desc}
            </Paragraph>
          )}
          <FormComponent
            questionnaire={questionnaire}
            triggers={triggers}
            submit={submit}
            setAllState={setAllState}
            setAllFormValues={setAllFormValues}
            allFormValues={allFormValues}
            isView={readOnly}
          />
        </>
      )}
    </AttributeLabel>
  );
};

export default MarkTaskHall;
