import * as React from 'react';
import { connect } from 'react-redux';
import styled from '@emotion/styled/macro';
import moment from 'moment';
import uuid from 'uuid/v4';
import smalltalk from 'smalltalk';
import * as actions from '../actions';
import { Task as TaskType, Dispatch, Repo, State as AppState } from '../type';
import Button from './Button';
import { ORG } from '../lib/github-api';

const Wrap = styled.li`
  background: #999;
  color: #222;
  border-radius: 3px;
  box-shadow: 3px 6px 9px black;
  display: inline-block;
  list-style: none;
  margin-bottom: 35px;
  padding: 14px 21px;
  cursor: pointer;

  & h1 {
    font-size: 20px;
    background: #121212;
    border-top-right-radius: 3px;
    border-top-left-radius: 3px;
    color: #ddd;
    margin: -14px -21px 12px -21px;
    padding: 16px;
  }

  & p.friend {
    font-weight: 700;
    font-size: 17px;
    color: #333;
  }

  & i {
    padding-right: 0.4em;
  }

  & .actions {
    margin-bottom: 10px;

    & .delete,
    & .work {
      margin-left: 50px;
    }

    & .delete {
      color: red;
    }

    & > * {
      border-radius: 3px;
      display: inline-block;
      width: 190px;
      margin-top: 10px;
      background: #eaeaea;
    }

    & > .work {
      background: var(--accent);
      color: white;
    }

    & > .invisible {
      opacity: 0;
      cursor: default;
    }
  }

  & .time {
    list-style: none;
    color: white;
    opacity: 0.5;
    margin-bottom: 20px;
    padding-left: 20px;
    line-height: 150%;
  }
`;

type Props = {
  task: TaskType;
  repo: Repo;
  taskHasWork: boolean;
  resubmit: Dispatch;
  submit: Dispatch;
  workOnTask: Dispatch;
  deleteTask: Dispatch;
  updateTask: Dispatch;
  reInitTask: Dispatch;
};

type State = {
  submitting: boolean;
};

class Task extends React.Component<Props, State> {
  state = {
    submitting: false,
  };

  confirmDelete = () => {
    if (process.env.NODE_ENV === 'development') {
      this.deleteTask();
      return;
    }

    const msg =
      'You will lose any work and there is no undo.\nPlease type "Hubberthorne" to confirm:\n\n';
    smalltalk
      .prompt('Delete Task?', msg)
      .then((value: string) => {
        if (value === 'Hubberthorne') {
          this.deleteTask();
        }
      })
      .catch(() => {});
  };

  deleteTask() {
    const { task, deleteTask } = this.props;
    deleteTask(task.id);
  }

  submit = async () => {
    const { task, submit } = this.props;
    this.setState({ submitting: true });
    await submit(task);
    this.setState({ submitting: false });
  };

  resubmit = async () => {
    const { task, resubmit } = this.props;
    this.setState({ submitting: true });
    await resubmit(task);
    this.setState({ submitting: false });
  };

  submitText() {
    const {
      task: { prNumber },
    } = this.props;
    const { submitting } = this.state;
    if (submitting) {
      return 'Submitting...';
    }
    return prNumber ? 'Re-submit' : 'Submit';
  }

  render() {
    const { submitting } = this.state;
    const { task, repo, workOnTask, taskHasWork, reInitTask } = this.props;
    return (
      <Wrap>
        <h1>
          <i
            className="fas fa-code-branch"
            onContextMenu={e => {
              e.preventDefault();
              smalltalk
                .confirm(
                  'Recover?',
                  'Recover allows you to re-submit a task that has been worked on after the PR has been merged.',
                  { buttons: { ok: 'Recover', cancel: 'Cancel' } },
                )
                .then(() => reInitTask({ id: task.id, newId: uuid() }))
                .catch(() => {});
            }}
          />{' '}
          {task.name}
        </h1>
        <p className="friend">
          Friend: <em>{repo.friendName}</em>
        </p>
        <ul className="time">
          <li>
            <i className="far fa-calendar" />
            <i>Created:</i>
            {moment(task.created).format('M/D/YY [at] h:mm:ssa')}
          </li>
          <li>
            <i className="far fa-calendar" />
            <i>Last updated:</i>
            {moment(task.updated).from(moment())}
          </li>
        </ul>
        <div className="actions">
          {task.prNumber ? (
            <Button
              secondary
              target="_blank"
              href={`https://github.com/${ORG}/${repo.slug}/pull/${task.prNumber}`}
              className="pr"
            >
              <i className="fas fa-code-branch" />
              View pull request
            </Button>
          ) : (
            <Button className="invisible">¯\_(ツ)_/¯</Button>
          )}
          <Button secondary className="delete" onClick={this.confirmDelete}>
            <i className="far fa-trash-alt" />
            Delete
          </Button>
          <Button
            secondary
            disabled={!taskHasWork || submitting}
            className="submit"
            onClick={task.prNumber ? this.resubmit : this.submit}
          >
            <i className="fas fa-cloud-upload-alt" />
            {this.submitText()}
          </Button>
          <Button className="work" onClick={() => workOnTask(task.id)}>
            <i className="fas fa-pencil-alt" />
            Work
          </Button>
        </div>
      </Wrap>
    );
  }
}

const mapState = (state: AppState, { task }: Props) => {
  const repo = state.repos.find(r => r.id === task.repoId);
  if (!repo) {
    throw new Error(`Could not find repo with id ${task.repoId}`);
  }
  return {
    task,
    repo,
    taskHasWork: !!Object.values(task.files).find(f => !!f.editedContent),
  };
};

const mapDispatch = {
  submit: actions.submitTask,
  resubmit: actions.resubmitTask,
  workOnTask: actions.workOnTask,
  updateTask: actions.updateTask,
  deleteTask: actions.deleteTask,
  reInitTask: actions.reInitTask,
};

export default connect(
  mapState,
  mapDispatch,
)(Task);