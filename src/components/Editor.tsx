import * as React from 'react';
import { connect } from 'react-redux';
import AceEditor from 'react-ace';
import { withSize } from 'react-sizeme';
import debounce from 'lodash/debounce';
import { lint } from '@friends-library/adoc-lint';
import { LintResult, LintOptions } from '@friends-library/adoc-lint';
import { Parser, ParserError } from '@friends-library/parser';
import { Dispatch, State } from '../type';
import { requireCurrentTask } from '../select';
import * as actions from '../actions';
import Centered from './Centered';
import StyledEditor from './StyledEditor';
import { addKeyCommands } from './editor-key-commands';
import { editorSubsetLintOptions } from '../lib/lint';
import './adoc-mode';
import './adoc-snippets';
import 'brace/theme/tomorrow_night';

const noopEditor = new Proxy(
  {},
  {
    get(target, prop, receiver) {
      const fn = (): typeof receiver => receiver;
      Object.setPrototypeOf(fn, receiver);
      return fn;
    },
  },
);

const ChooseAFile: React.FC = () => (
  <Centered>
    <p style={{ opacity: 0.5 }}>
      <span role="img" aria-label="left">
        👈{` `}
      </span>
      {` `}
      choose a file
    </p>
  </Centered>
);

interface StateProps {
  fontSize: number;
  adoc?: string;
  githubUser: string;
  size: { width: number; height: number };
  searching: boolean;
  lintOptions: LintOptions;
}

interface DispatchProps {
  updateFile: Dispatch;
  undo: Dispatch;
  redo: Dispatch;
  find: Dispatch;
  increaseFontSize: Dispatch;
  decreaseFontSize: Dispatch;
  toggleSidebarOpen: Dispatch;
}

export type Props = StateProps & DispatchProps;

class Editor extends React.Component<Props> {
  private aceRef = React.createRef<any>();

  public override componentDidMount(): void {
    const editor = this.editor();
    addKeyCommands(editor, this.props);
    editor.focus();
    editor.gotoLine(0);
    editor.setPrintMarginColumn(90);
    this.checkErrors(editor.getValue());
  }

  public override componentDidUpdate(prev: Props): void {
    const { size, searching } = this.props;
    if (size.width !== prev.size.width || searching !== prev.searching) {
      this.editor().resize();
    }

    // ace seems to sometimes lose commands ¯\_(ツ)_/¯
    if (!this.editor().commands.commands.increaseFontSize) {
      addKeyCommands(this.editor(), this.props);
    }
  }

  protected checkErrors(adoc: unknown): void {
    if (typeof adoc !== `string`) {
      return;
    }

    const lints = lint(adoc, this.props.lintOptions)
      .filter(
        (l) =>
          l.fixable !== true || [`join-words`, `obsolete-spellings`].includes(l.rule),
      )
      .filter((l) => l.rule !== `temporary-comments`);

    try {
      Parser.parseDocument({ adoc });
    } catch (err) {
      if (err instanceof ParserError) {
        // don't show parser error if we already have a lint on the line
        if (lints.every((lint) => lint.line !== (err as ParserError).lineNumber)) {
          lints.push({
            type: `error`,
            line: err.lineNumber,
            rule: `parser-error`,
            message: `PARSER ERROR: ${err.message}`,
            info: err.codeFrame
              .split(`\n`)
              .filter((l, i) => i > 2)
              .join(`\n`),
            column: err.columnStart,
          });
        }
      }
    }

    this.annotateLintErrors(lints);
  }

  protected annotateLintErrors(lints: LintResult[]): void {
    this.editor()
      .getSession()
      .setAnnotations(
        lints.map((lint) => {
          let text = lint.message;
          if (lint.recommendation) {
            text += `\n\n>> Recommended fix:\n\n${lint.recommendation}`;
          }
          if (lint.info) {
            text += `\n\n>> More info:\n\n${lint.info}`;
          }
          return {
            row: lint.line - 1,
            column: lint.column,
            text,
            type: `warning`,
          };
        }),
      );
  }

  protected editor(): any {
    if (this.aceRef.current && this.aceRef.current.editor) {
      return this.aceRef.current.editor;
    }
    return noopEditor;
  }

  protected renderAce(): JSX.Element {
    const { updateFile, adoc, fontSize } = this.props;
    return (
      <AceEditor
        style={{ fontSize }}
        ref={this.aceRef}
        mode="adoc"
        theme="tomorrow_night"
        onChange={debounce((adoc) => {
          updateFile(adoc);
          this.checkErrors(adoc);
        }, 500)}
        value={adoc || ``}
        editorProps={{ $blockScrolling: true }}
        setOptions={{
          enableSnippets: true,
          // @ts-ignore
          indentedSoftWrap: false,
          wrap: true, // !!! <- must be after `indentedSoftWrap`
        }}
      />
    );
  }

  public override render(): JSX.Element {
    const { adoc, searching } = this.props;
    return (
      <StyledEditor searching={searching} className="Editor">
        {adoc === undefined ? <ChooseAFile /> : this.renderAce()}
      </StyledEditor>
    );
  }
}

const mapState = (state: State): Omit<StateProps, 'size'> => {
  const task = requireCurrentTask(state);
  const file = task.files[task.editingFile || ``];
  return {
    lintOptions: editorSubsetLintOptions(file ? file.path : ``),
    githubUser: state.github.token !== null ? state.github.user : ``,
    fontSize: state.prefs.editorFontSize,
    searching: state.search.searching,
    adoc: file ? file.editedContent || file.content : undefined,
  };
};

const mapDispatch = {
  updateFile: actions.updateEditingFile,
  toggleSidebarOpen: actions.toggleSidebarOpen,
  undo: actions.undoTasks,
  redo: actions.redoTasks,
  find: actions.findInCurrentFile,
  increaseFontSize: actions.increaseEditorFontSize,
  decreaseFontSize: actions.decreaseEditorFontSize,
};

const SizedEditor = withSize({ monitorHeight: true })(Editor);
export default connect(mapState, mapDispatch)(SizedEditor);
