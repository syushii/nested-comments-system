import { makeRequest } from "./makeRequest"

export function getPosts() {
  return makeRequest("/posts")
}

export function getPost(id) {
  return makeRequest(`/posts/${id}`)
}


const {execute, ...state} = {a:1, b:2, execute: {d:4}};
console.log(execute);