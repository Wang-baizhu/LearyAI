"""该文件职责：更新 todo 列表，并将其转换成统一的展示块。"""

from pathlib import Path
from typing import Literal, override

from kosong.tooling import CallableTool2, ToolReturnValue
from pydantic import BaseModel, Field, field_validator

from kimi_cli.session_state import TodoItemState
from kimi_cli.soul.agent import Runtime
from kimi_cli.tools.display import TodoDisplayBlock, TodoDisplayItem
from kimi_cli.tools.utils import load_desc


TodoStatus = Literal["pending", "in_progress", "completed"]


class Todo(BaseModel):
    title: str = Field(description="The title of the todo", min_length=1)
    status: TodoStatus = Field(description="The status of the todo")

    @field_validator("status", mode="before")
    @classmethod
    def normalize_legacy_done(cls, value: str) -> str:
        if value == "done":
            return "completed"
        return value


class Params(BaseModel):
    todos: list[Todo] = Field(description="The updated todo list")


class SetTodoList(CallableTool2[Params]):
    name: str = "SetTodoList"
    description: str = load_desc(Path(__file__).parent / "set_todo_list.md")
    params: type[Params] = Params

    def __init__(self, runtime: Runtime):
        super().__init__()
        self._runtime = runtime

    @override
    async def __call__(self, params: Params) -> ToolReturnValue:
        self._runtime.session.state.todos = [
            TodoItemState(
                title=todo.title,
                status="done" if todo.status == "completed" else todo.status,
            )
            for todo in params.todos
        ]
        await self._runtime.session.save_state()
        items = [
            TodoDisplayItem(
                title=todo.title,
                status="done" if todo.status == "completed" else todo.status,
            )
            for todo in params.todos
        ]
        return ToolReturnValue(
            is_error=False,
            output="",
            message="Todo list updated",
            display=[TodoDisplayBlock(items=items)],
        )
